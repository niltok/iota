# W 类型 (W Type)

### By 玩火

简单来说，W 类型是一种通用的编码 Dependent Inductive Type 的方式。

## 数据类型的归纳

归纳构造数据是一种从简单构造器组合成整个对象的过程。比如列表就是由 `Nil` 和 `Cons` 两个构造器组合而成的：

```idris
data List a = Nil | (::) a (List a)
```

而归纳构造的数据类型可以用结构归纳法证明其上的性质，比如对于 `List` 来说通用的证明就是：

```idris
indList : (P : List a -> Type) -> 
    (P Nil) -> 
    ((x : a) -> (xs : List a) -> P xs -> P (x :: xs)) -> 
    (xs : List a) -> 
    P xs
indList _ nil cons Nil = nil
indList p nil cons (x :: xs) = cons x xs (indList p nil cons xs)
```

这个 `indList` 中的 `P` 就是一个依赖于一个列表的命题，用非形式化的语言描述 `indList` 就是：如果对于空表来说该命题成立（存在 `P Nil`）且如果对于一个列表来说该命题成立（存在 `P xs`）那么对于多一个元素的该列表成立（存在 `P (x :: xs)`），此时可以得出结论，对于任意列表来说该命题成立（也就是 `(xs : List a) -> P xs`）。

> 明明 `P` 是个产生类型的函数，为什么说它是一个依赖于一个列表的命题呢？参考 [Curry-Howard 同构](https://magic.huohuo.moe/html/CHIso.html)

## 通用的归纳构造

众所周知，归纳数据结构构造出的对象应当是有限的多叉树形结构（在通过 termination check 的情况下）。很显然，任意的归纳数据结构都存在一个多叉树的同构，那么其实仅仅使用通用的多叉树就可以构造出任意的归纳数据结构：

```idris
data Ind : (a : Type) -> (size : a -> Nat) -> Type where
    MkInd : (x : a) -> Vect (size x) (Ind a size) -> Ind a size
```

我们把所有的构造器的参数分成两部分，一部分是承载的数据，全部打包放在了 `x : a` 中，另一部分是子分支数组，被拆分出来放在了 `Vect (size x) (Ind a size)` 中

这里举个 `Ind` 构造出 `List` 的例子：

```idris
listSize : (a : Type) -> Maybe a -> Nat
listSize _ Nothing = 0
listSize _ (Just _) = 1

List' : Type -> Type
List' a = Ind (Maybe a) (listSize a)

nil : List' a
nil = MkInd Nothing Nil

cons : a -> List' a -> List' a
cons x xs = MkInd (Just x) (xs :: Nil)
```

和 `List` 一样，`Ind` 也有归纳性质：

```idris
indInd : (P : Ind a size -> Type) ->
    ((x : a) -> (v : Vect (size x) (Ind a size)) -> ((i : Fin (size x)) -> P (index i v)) -> P (MkInd x v)) ->
    (n : Ind a size) ->
    P n
indInd p f (MkInd x v) = f x v (\i => indInd p f (index i v))
```

相比 `List` 只需要一个后续节点的归纳结果， `Ind` 需要所有子树的归纳结果并组合起来，这里用了一个 `i` 来索引第 `i` 个子树归纳结果 `P (index i v)`。

## W 类型

上述 `Ind` 依赖 `Nat`, `Fin` 和 `Vect` 的实现，它们编码了子节点列表及其下标。而 W 类型就是在 `Ind` 的思想基础上用更基础的方式实现了前述的列表和下标的编码。为了做到这一点，得考虑更加底层的编码「数字」与「数组」的办法。而恰巧代数数据类型本身就蕴含着数量的概念，类型拥有的实例数量就可以看成是下标的数量上限，而每个具体实例可以看作是具体的下标，利用函数就可以把下标映射到各个分支上：

```idris
data W : (a : Type) -> (b : a -> Type) -> Type where
    Sup : (x : a) -> (b x -> W a b) -> W a b
```

从某种角度上来说上述 `Ind` 中的 `Vect (size x) (Ind a size)` 的用途可以看作是 `Fin (size x) -> Ind a size`，而这 `Fin (size x)` 某种程度上来说就是对 W 类型中 `b x` 的特化：

```idris
IndByW : (a : Type) -> (a -> Nat) -> Type
IndByW a size = W a (\x => Fin (size x))
```

参考 `Ind` 的归纳实现，可以很简单写出 W 类型的归纳实现：

```idris
indW : (P : W a b -> Type) ->
    ((x : a) -> (f : b x -> W a b) -> ((i : b x) -> P (f i)) -> P (Sup x f)) ->
    (n : W a b) ->
    P n
indW p f (Sup x v) = f x v (\i => indW p f (v i))
```

和上面的 `Ind` 一样，这里举个用 W 类型构造 `List` 的例子：

```idris
listIndex : (a : Type) -> (Maybe a) -> Type
listIndex _ Nothing = Void
listIndex _ (Just x) = ()

ListW : Type -> Type
ListW a = W (Maybe a) (listIndex a)

nilW : ListW a
nilW = Sup Nothing (\x => void x)

consW : a -> ListW a -> ListW a
consW x xs = Sup (Just x) (\_ => xs)
```

## 有啥用？

我觉得学一样东西最重要的地方就是了解到它有啥用，为了了解到它有啥用会有更大的动力去研究和用途密切相关的它的形式与特性。在文章的开头提到它可以用来编码任意 Dependent Inductive Type ，而在研究类型论的时候想从啥也没有之中构造出任意 Dependent Inductive Type 的时候 W 类型就有非常大的优势。W 的类型定义就是它和它的实例的 Introduction Rules，而 `indW` 就是它的 Computation Rules。

而在语言之外设计好这些 Rules 了以后想用它真的来编码类型还需要一些辅助类型，比如上面构造 `ListW` 所需要 `Maybe`, `Void` 和 `()` 类型。我们需要这些类型来承载数据和为分支提供索引，所幸的是这些类型并不需要归纳结构，所以只需要简单的 `Void`, `()`, `Bool` 外加 Dependent Pair 就可以编码了。比如 `Maybe` 就可以编码为：

```idris
Maybe' : Type -> Type
Maybe' a = (label : Bool ** case label of 
    True => Void
    False => a)
```

用 `True` 和 `False` 的序列为每个构造器命名，然后用 Dependent Pair 和 Bool 的 Elimination Rules 来把命名映射到构造器的具体参数类型上。

> Reference: 
>
> [Inductive type and W Type - VinaLx](https://vinalx.github.io/articles/2019/03/w-type)