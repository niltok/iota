
# 点菜数据类型 (Data types à la carte)

> 本文是 [这篇论文](https://www.cambridge.org/core/journals/journal-of-functional-programming/article/data-types-a-la-carte/14416CB20C4637164EA9F77097909409#) 的粗略科普，一些比较细节的地方还是建议去读原文了解。

## Expression problem

在 Haskell 中实现一个简单的运算解释器是件很容易的事情：

```haskell
data Expr = Val Int | Add Expr Expr

eval :: Expr -> Int
eval (Val x) = x
eval (Add a b) = (eval a) + (eval b)
```

定义 `Expr` 类型之后我们还可以为它添加一些别的功能，比如打印：

```haskell
render :: Expr -> String
render (Val x) = show x
render (Add a b) = "(" ++ (render a) ++ " + " ++ (render b) ++ ")"
```

可以看到像这样定义的表达式，添加一个功能并不需要改动原来的代码，非常容易，但如果想扩展表达式节点类型，就需要修改所有的功能代码增加模式匹配分支，这就非常麻烦了。如果用 Java 那种面向对象编程的处理方法又会导致添加子类很容易但添加方法需要修改所有子类。而 Expression problem 的目标是让扩展功能和扩展节点类型尽量解耦，使添加新功能和新类型都不需要修改原始代码。

## 着手尝试解决

既然希望自由扩展节点类型定义那分离类型定义和节点定义应该是看上去不错的方向。比如，这里把表达式的节点类型当成 `Expr` 类型的参数 `f`：

```haskell
data Expr f = In (f (Expr f))
```

注意构造器 `In` 参数的类型，它把 `Expr f` 作为了 `f` 的参数，这样 `f` 就能拿到它所在的主表达式的类型，进而可以递归传递给子表达式。这个操作就类似于 Y 组合子把 `Y f` 作为 self 参数传递给递归函数。这样一来就可分别定义 `Val` 和 `Add` 的节点类型：

```haskell
data Val e = Val Int
type ValExpr = Expr Val

data Add e = Add e e
type AddExpr = Expr Add
```

这里的 `ValExpr` 就是只有 `Val` 节点的表达式，同理 `AddExpr` 就是只有 `Add` 节点的表达式。按照函数式的思想，还需要什么东西来把它们组合起来才能形成复杂的表达式。

```haskell
data (f :+: g) e = Inl (f e) | Inr (g e)
```

那么 `Expr (f :+: g)` 就可以表示包含 `f` 和 `g` 的表达式。那为什么是类似于 `Either` 的结构呢？因为该类型的实例表示的 AST 的根节点要么是 `f` 类型的节点，要么是 `g` 类型的节点。（而子节点的类型又来自 `e` 传递的主表达式类型）。这里就举个表示 `119 + 1219` 的 AST 例子：

```haskell
addExample :: Expr (Val :+: Add)
addExample = In (Inr (Add (In (Inl (Val 119)) (In (Inl (Val 1219)))))
```

如果想扩展表达式类型，只需要定义类型然后把多个类型用 `:+:` 组合起来就可以了。比如如果想再加个 `Sub` 就可以用 `Expr (Val :+: Add :+: Sub)` 表示。

## 求值

很显然，之前定义的几个表达式类型包括 `:+:` 都是 Functor：

```haskell
instance Functor Val where
  fmap f (Val x) = Val x

instance Functor Add where
  fmap f (Add a b) = Add (f a) (f b)

instance (Functor f, Functor g) => Functor (f :+: g) where
  fmap f (Inl x) = Inl (fmap f x)
  fmap f (Inr x) = Inr (fmap f x)
```

既然它们是 Functor，我们就可以在它们上面 fold：

```haskell
foldExpr :: Functor f => (f a -> a) -> Expr f -> a
foldExpr f (In x) = f (fmap (foldExpr f) x)
```

考虑定义一个 typeclass 来描述各表达式类型的求值方法：

```haskell
class Functor f => Eval f where
  evalAlgebra :: f Int -> Int

instance Eval Val where
  evalAlgebra (Val x) = x

instance Eval Add where
  evalAlgebra (Add a b) = a + b

instance (Eval f, Eval g) => Eval (f :+: g) where
  evalAlgebra (Inl x) = evalAlgebra x
  evalAlgebra (Inr x) = evalAlgebra x
```

而求值过程本质上就是在 AST 上对 `evalAlgebra` 的 fold：

```haskell
eval :: Eval f => Expr f -> Int
eval = foldExpr evalAlgebra
```

于是就可以用 `eval addExample` 求出 `119 + 1219` 为 `1137`。这时候若是想加入 `Sub` 则只需要为其实现 `Functor` 和 `Eval` typeclass。

> Haskell 中有个叫 Finally Tagless 的办法也同样可以用来解决 Expression problem，实际上它的思路和这里的 `Eval` 非常类似，只是扩展功能的思路不太一样。这里推荐 [千里冰封写得相关文章](https://zhuanlan.zhihu.com/p/53810286) 里面包括了 Java 中的 Visitor 模式和 Haskell 中的 Finally Tagless 的介绍。
>
> 就个人感觉，Data type à la carte 和 Finally Tagless 思路挺相似，但是 Data type à la carte 的组合模式更加自由，而 Finally Tagless 既不需要 `:+:` 和自动注入之类的基础工具支持也不需要 OverlappingInstances 这样的语言支持，用起来更贴近原生 Haskell。

## 自动注入

从上面的例子可以发现 `addExample` 的例子非常复杂，而且如果把类型中的 `Val` 和 `Add` 换个顺序或加入一个 `Sub` 它就直接炸了，可移植性很差。我们需要一个能把各节点自动注入到组合类型中的智能构造器来解耦表达式和它的类型。考虑形如 `a :+: b :+: c :+: ...` 的组合类型 `f` ，若这个列表中存在 `Val` 则智能构造器 `val` 可以被注入其中。我们定义一个 typeclass 运算符 `:<:` 来表示可以注入的关系：

```haskell
class (Functor f, Functor g) => f :<: g where
  inj :: f a -> g a
```

而这个 `:+:` 中的 `inj` 则用于生成节点 `f` 在组合类型 `g` 中由 `Inl` 和 `Inr` 组成的构造路径。就比如在 `addExample` 中，对于 `Val :<: (Val :+: Add :+: Sub)` 则可以生成 `Inl`，而对于 `Add :<: (Val :+: Add :+: Sub)` 则可以生成 `Inr . Inl`。

而它的具体实现就是在这原理基础上的归纳：

```haskell
instance (Functor f) => f :<: f where
  inj = id

instance (Functor f, Functor g) => f :<: (f :+: g) where
  inj = Inl

instance (Functor f, Functor g, Functor h, f :<: g) => f :<: (h :+: g) where
  inj = Inr . inj
```

有了构造路径再套上一个 `In`，我们就可以为 `Expr` 构造出特化的自动注入函数并为各表达式节点类型构造智能构造器：

```haskell
inject :: (f :<: g) => g (Expr f) -> Expr f
inject = In . inj

val :: (Val :<: f) => Int -> Expr f
val x = inject (Val x)

add :: (Add :<: f) => Expr f -> Expr f -> Expr f
add x y = inject (Add x y)
```

利用 typeclass 约束，这里的 `val` 和 `add` 可以被注入到任意包含对应类型的 `f` 组合类型中。

这样就可以轻松构造出 AST 了：

```haskell
injExample :: Expr (Val :+: Add)
injExample = add (val 30000) (add (val 1330) (val 7))
```

用 `eval injExample` 就可以得到 `31337`，而且不管怎么修改 `injExample` 的类型，只要列表里面包含 `Val` 和 `Add` 都能自动生成正确的 AST。

## 更多例子

在上面 `Val :+: Add` 的基础上，我们再尝试加入 `Mul` 节点：

```haskell
data Mul e = Mul e e

instance Functor Mul where
  fmap f (Mul x y) = Mul (f x) (f y)

instance Eval Mul where
  evalAlgebra (Mul x y) = x * y

mul :: (Mul :<: f) => Expr f -> Expr f -> Expr f
mul x y = inject (Mul x y)
```

就只需要加这么几行就可以在原来的功能上增加 `Mul` 节点了，完全不需要修改原本的代码。然后在此基础上扩展打印功能：

```haskell
class Render f where
  render :: (Render g) => f (Expr g) -> String

pretty :: (Render f) => Expr f -> String
pretty (In x) = render x

instance Render Val where
  render (Val x) = show x

instance Render Add where
  render (Add x y) = "(" ++ pretty x ++ " + " ++ pretty y ++ ")"

instance Render Mul where
  render (Mul x y) = "(" ++ pretty x ++ " * " ++ pretty y ++ ")"

instance Render f => Render (f :+: g) where
  render (Inl x) = render x
  render (Inr x) = render x
```

同样只需要添加新代码而不需要改动原代码。用 `pretty injExample` 就可以得到 `"(30000 + (1330 + 7))"`。

> 这个 `Render` 的例子在原论文中并没有像之前的 `Eval` 使用 fold 来定义而是直接递归，说实话我还挺困惑的，强迫症表示看着很不舒服。如果说想像之前那样用 fold 定义应该是这样的（并没有编译运行验证过）：
>
> ```haskell
> class Render f where
>     render :: f String -> String
>
> instance Render Val where
>     render (Val x) = show x
>
> instance Render Add where
>     render (Add x y) = "(" ++ x ++ " + " ++ y ++ ")"
>
> instance Render Mul where
>     render (Mul x y) = "(" ++ x ++ " * " ++ y ++ ")"
>
> instance (Render f, Render g) => Render (f :+: g) where
>     render (Inl x) = render x
>     render (Inr x) = render x
>
> pretty :: (Render f) => Expr f -> String
> pretty = foldExpr render
> ```

另外，`f :<: g` 既然能把类型 `f` 的实例注入成组合类型 `g`，那也应该存在一个偏函数把 `g` 的实例投射到 `f` 上：

```haskell
class (Functor f, Functor g) => f :<: g where
  inj :: f a -> g a
  prj :: g a -> Maybe (f a)

instance (Functor f) => f :<: f where
  inj = id
  prj = Just

instance (Functor f, Functor g) => f :<: (f :+: g) where
  inj = Inl
  prj (Inl x) = Just x
  prj _ = Nothing

instance (Functor f, Functor g, Functor h, f :<: g) => f :<: (h :+: g) where
  inj = Inr . inj
  prj (Inr x) = Just x
  prj _ = Nothing
```

这个投射在有些时候还挺有用，比如变换 AST 的时候有可能需要解构实例。这里有个乘法分配律的例子：

```haskell
match :: (f :<: g) => Expr f -> Maybe (g (Expr f))
match (In x) = prj x

distr :: (Add :<: f, Mul :<: f) => Expr f -> Maybe (Expr f)
distr t = do
  Mul a b <- match t
  Add c d <- match b
  pure (add (mul a c) (mul a d))
```

在知道原表达式 `t` 的结构为 `mul a (add c d)` 的情况下利用投射匹配得到 `a` `b` `c` 然后再重新组合。

## Monads for free

考虑对 `Expr` 做出如下修改：

```haskell
data Term f a = Pure a | Impure (f (Term f a))
```

它包含了无副作用的值和带副作用的操作。

可以证明如果参数 `f` 是一个 Functor 那么它是一个 Monad：

```haskell
instance Functor f => Functor (Term f) where
  fmap f (Pure x) = Pure (f x)
  fmap f (Impure x) = Impure (fmap (fmap f) x)

instance Functor f => Applicative (Term f) where
  pure = Pure
  Pure f <*> x = fmap f x
  Impure f <*> x = Impure (fmap (<*> x) f)

instance Functor f => Monad (Term f) where
  Pure x >>= f = f x
  Impure x >>= f = Impure (fmap (>>= f) x)
```

这就是著名的 Free Monad，它能把任意 Functor 变成 Monad。

> 原论文并没有实现 Applicative，据说是因为曾经 Monad 并不依赖于 Applicative，这也是曾经 Monad 具有 `return` 这样一个和 `pure` 功能重复的函数的原因。
>
> 有些人觉得这里的 Free 翻译为「免费」因为它可以不需要额外代码就能把一个 Functor 变成 Monad，不过另一些人觉得应该翻译成「自由」因为在性质上是和 Forgetful 相反的，它可以自由扩展而不需要修改原代码。

很多你熟悉的 Monad 都可以由 Free Monad 构造，考虑以下类型：

```haskell
data Zero a
data One a = One
data Const e a = Const e
```

于是 `Term Zero` 实际上就是只保存一个值的单位 Monad，`Term One` 是 `Maybe`， `Term (Const e)` 则是 `Either e`。不过同样也有很多 Monad 并不是 Free 的，比如 `List` 和 `State`。

尽管 `State` 不是 Free Monad 但利用 `Term` 可以用来表示具有状态的计算语言。这里举个能获取值 (Recall)、增加值 (Incr) 和清空值 (Clear) 的例子：

> Clear 功能在原论文中是个练习，这里顺手写了。

```haskell
data Recall t = Recall (Int -> t)
data Incr t = Incr Int t
data Clear t = Clear t

inject :: (f :<: g) => f (Term g a) -> Term g a
inject = Impure . inj

recall :: (Recall :<: f) => Term f Int
recall = inject (Recall pure)

incr :: (Incr :<: f) => Int -> Term f ()
incr n = inject (Incr n (pure ()))

clear :: (Clear :<: f) => Term f ()
clear = inject (Clear (pure ()))
```

利用 Haskell 的 do 语法糖可以轻松构造出复杂的语句，这里举个给状态值增加 1 然后返回原始值的例子：

```haskell
tick :: Term (Recall :+: Incr) Int
tick = do
  x <- recall
  incr 1
  pure x
```

这里的 `tick` 也可采用更泛化的类型 `(Recall :<: f, Incr :<: f) => Term f Int`，这样就能在任何包含 `Recall` 和 `Incr` 的 `Term` 中调用了。

接下来就按照之前 `Expr` 的经验来写出 `Term` 的解释器，只不过这里为了传递状态需要 fold 出一个签名为 `... => Term f a -> Int -> (a, Int)` 函数：

```haskell
-- 第一个参数用来折叠 Pure，第二个参数用来折叠 Impure
foldTerm :: Functor f => (a -> b) -> (f b -> b) -> Term f a -> b
foldTerm pure impure (Pure x) = pure x
foldTerm pure impure (Impure x) = impure (fmap (foldTerm pure impure) x)

class Functor f => Run f where
  runAlgebra :: f (Int -> (a, Int)) -> (Int -> (a, Int))

instance Run Recall where
  runAlgebra (Recall f) i = f i i

instance Run Incr where
  runAlgebra (Incr n f) i = f (i + n)

instance Run Clear where
  runAlgebra (Clear f) _ = f 0

run :: (Run f) => Term f a -> (Int -> (a, Int))
run = foldTerm (\a x -> (a, x)) runAlgebra
--    foldTerm (,) runAlgebra
```

这里 `run` 的效果就很类似 `runState` 了。于是 `run tick 4` 就可以得到 `(4, 5)`。

## 应用

类似于之前的 `Expr` 可以组合不同的表达式节点，`Term` 也可以组合不同的 Free Monad 到一起使用。这里举个终端和文件系统混合输入输出的例子：

```haskell
data Teletype a = 
    PutChar Char a 
  | GetChar (Char -> a)
data FileSystem a = 
    WriteFile FilePath String a 
  | ReadFile FilePath (String -> a)

-- 省略了 Functor 实现

class Functor f => Exec f where
  execAlgebra :: f (IO a) -> IO a

instance Exec Teletype where
  execAlgebra (PutChar c x) = Prelude.putChar c >> x
  execAlgebra (GetChar f) = Prelude.getChar >>= f

instance Exec FileSystem where
  execAlgebra (WriteFile fp s x) = Prelude.writeFile fp s >> x
  execAlgebra (ReadFile fp f) = Prelude.readFile fp >>= f

-- 省略了智能构造器的实现

exec :: (Exec f) => Term f a -> IO a
exec = foldTerm pure execAlgebra

cat :: (Teletype :<: f, FileSystem :<: f) => FilePath -> Term f ()
cat fp = do
  contents <- readFile fp
  mapM putChar contents
  pure ()
```

## 玩火的后记

记录一些读完原论文后的想法，算是一些原文没明说的个人理解。

### 关于命名

所谓点菜 (à la carte) 就是指分开点的菜，这样编程就好像在一家餐厅点菜，餐厅预先准备了可以用来「炒」的几个菜，可以用来「炖」的几个菜（库中实现了求值的几个节点类型，实现了打印的几个节点类型），而我就可以按照我的需求把西红柿和鸡蛋组合起来（把 `Teletype` 和 `FileSystem` 的节点组合成 `cat` 这样的 AST），然后要求厨师把它们炒成一盘菜（通过 `exec cat` 生成可执行代码）。

所以我感觉这个命名就非常有灵性。

### 关于 Effect

个人感觉这玩意特别适合拿来搞 Effect System，文末的 `cat` 例子就很能说明它的潜力。对于多种 Monad 混用的情况，目前 Haskell 的主流方案（标准库方案）是 Monad Transformer，但是这玩意一方面组合多了 lift 起来非常麻烦，另一方面使用的时候极其依赖 Monad 的组合顺序，非常不灵活，可以说是比较难用的方案。而点菜数据类型只需要指明用了哪些 Effect 就能自动处理复杂组合和扩展问题，而且它能在实现 `Exec` 时调用 `lift` 从而完美对接 Monad Transformer 原有的函数实现。

唯一想吐槽的是泛化的类型依赖列表在无语法糖的情况下写出来真是巨长，而且没办法用全局变量表达从而简化依赖长度。如果编译器再来个自动推导依赖列表的功能那将是绝杀，可惜暂时加不得。

### 关于 Free Monad

由于 `Impure` 的递归性质，只要给出合适的 `f`，实际上它能构造出任意形状的结构，但是为了保证 Monad 性质而存在的 `Pure` 使 Free Monad 不能和一些 Monad 完美匹配，比如文中提到的 `data [a] = Nil | a : [a]` 就不存在和 `Pure a` 类似的构造器。不过由于完备的 `Impure` 的存在，所有 ADT 都能嵌入到 Free Monad 当中。所以尽管不是所有的 Monad 都是 Free Monad，但 Free Monad 总能实现它们的实际功能。这事就有点类似于经典逻辑能嵌入到直觉主义逻辑，就我个人觉得直接拿更「大」的系统用也没啥问题。

### 在其他语言中的运用

我写之前在网上搜了搜看看有没有别的人写过翻译，结果发现了一个 [奇妙的仓库](https://github.com/jcouyang/alacarte/wiki/%E8%AF%BB%E6%88%91) ，作者把点菜数据类型搬到 JavaScript 里面了，还为它实现了一个运行时的注入检查。感觉非常离谱。不过由于 Overlapping Instances 的存在，目测主流语言里也就 C++ 能原生在编译期做到注入检查。
