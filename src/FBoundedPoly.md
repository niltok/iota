# F-Bounded Polymorphism

> 前言，在很久以前的某一天，我在魔法店水群，看到有人提到 F-Bounded Polymorphism，于是去搜索引擎找到了 [这篇文章](https://blog.lishunyang.com/2020/09/f-bounded-polymorphism.html) 。读完以后感觉挺有趣的就分享到了群里，不过群里人读完产生的疑惑似乎我也不知道怎么解答。于是这两天去读了 [原论文](http://staff.ustc.edu.cn/~xyfeng/teaching/FOPL/lectureNotes/CookFBound89.pdf)，结果发现那篇网文对 F-Bounded Polymorphism 的理解似乎有一些偏差……

## 背景

快速地描述一下形式化面向对象模型：

### Record 子类型

```typescript
type A = {
    x_1: X_1,
    x_2: X_2,
    ...
    x_n: X_n
}

type B = {
    y_1: Y_1,
    y_2: Y_2,
    ...
    y_n: Y_n,
    ...
    y_m: Y_m
}
```

当对于 `i` 等于 `1` 到 `n` 来说 `Y_i` 都是 `X_i` 的子类型时，就可以把 `B` 当作 `A` 的子类型。

### 函数子类型

```typescript
type F1 = (x: X1) => Y1

type F2 = (x: X2) => Y2
```

当 `Y2` 是 `Y1` 的子类型且 `X1` 是 `X2` 的子类型时， `F2` 就是 `F1` 的子类型。因为 `F2` 想替代 `F1` 的话需要接收 `X2`。

> 有疑问的话可以去看看协变与逆变相关知识。

### 带约束泛型

```typescript
type F<T extends A> = (x: T) => Y
```

泛型参数 `T` 必须是 `A` 的子类型。

## 碰到的问题

举个例子：

```typescript
type Comparable = {
    compareTo(other: Comparable): number
}

type Num = {
    value: number,
    compareTo(other: Num): number
}

function min<T extends Comparable>(a: T, b: T): T {
    return (a.compareTo(b) < 0) ? a : b
}
```

按照人类的直觉来说 `Num` 应该是 `Comparable` 的子类型，可以用于 `min` 的参数，甚至连 Typescript 编译器都认为这是对的，但是手动做下类型检查就会发现问题所在：

如果 `Num` 是 `Comparable` 的子类型，那么 `compareTo(other: Num)` 就是 `compareTo(other: Comparable)` 的子类型。所以按照函数参数逆变的规则，`Comparable` 应该是 `Num` 的子类型。这就会和我们先前的假设矛盾。

> Typescript 编译器认为这是对的，听上去挺奇怪，毕竟在 Typescript 中函数参数逆变是严格检查的，然而我准备提 Issue 的时候发现这是个常见被认为是 Bug 的行为。实际上这个问题在 2017 年函数参数逆变检查功能被实现的时候就有所考虑，如果严格检查方法参数逆变的话对当时泛型库会产生严重的兼容性问题所以被当成特例处理了。
>
> Reference: [Typescript#18654](https://github.com/microsoft/TypeScript/pull/18654)

## F-Bounded Polymorphism

熟悉 Java 的小伙伴可能会说：「Java 里的 Comparable 可不是这么定义的！」

```typescript
type Comparable<T> = {
    compareTo(other: T): number
}

function min<T extends Comparable<T>>(a: T, b: T): T {
    return (a.compareTo(b) < 0) ? a : b
}
```

这样一来 `Comparable<Num>` 中的函数成员就是 `compareTo(other: Num)` ，和 `Num` 中的 `compareTo` 完美匹配。于是 `Num` 就是 `Comparable<Num>` 的子类型了，所以 `Num` 能满足 `min` 函数的类型参数中的 `T extends Comparable<T>` 约束，这样就可以通过类型检查了。

这个 `T extends Comparable<T>` 看上去挺奇怪的，定义对 `T` 的约束中有对 `T` 的引用，但手工代入类型以后会发现它倒也能正常工作。这个非常有递归风味的约束就叫 F-Bounded Quantification。而利用该约束定义的多态，就叫 F-Bounded Polymorphism。

而精通 Typescript 的小伙伴肯定会想到，这里的 Best Practice 实际上是使用 `this` 类型：

```typescript
type Comparable = {
    compareTo(other: this): number
}

function min<T extends Comparable>(a: T, b: T): T {
    return (a.compareTo(b) < 0) ? a : b
}
```

这实际上就是 Typescript 中 F-Bounded Polymorphism 的语法糖。

至于在 Java 中，这一操作也被标准库大量使用，最为常见的便是 `Comparable` 接口：

```java
interface Comparable<T> {
    int compareTo(T other);
}

class Num implements Comparable<Num> {
    int value;
    int compareTo(Num other) {
        return value - other.value;
    }
    static <T extends Comparable<T>> T min(T a, T b) {
        return (a.compareTo(b) < 0) ? a : b;
    }
}
```

类似的还有 C++ 中的 CRTP。

## FAQ

### 什莫事 "F"

原论文中定义 F-Bounded Quantification 的时候用了 $\forall t \sube F[t]. \sigma$ 其中的 t 就是作为参数的子类型，而 F 就是有着子类型 `t` 作为泛型参数的父类型，就比如上面举例子用的 `T extends Comparable<T>`。**注意 F 并不是那篇网文中所说的那样为一个函数！**

### 先有鸡还是先有蛋

在 `T extends F<T>` 中，只有 `F` 是 free 的，所以必然是先有 `F` 再有 F-Bounded Quantification。不过对于具体的作为子类型的 `T` 来说，倒是要看类型系统对继承的要求了。像 Typescript 这种 structural typing 并不在意先定义接口还是子类型，但像 Java 那种 nominal typing 就会要求继承时给定接口，所以需要先定义接口。
