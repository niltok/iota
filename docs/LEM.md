# 直觉主义逻辑中的排中律

### By 「玩火」

> 前言：
>
> 这篇记录是和 Trebor 大佬的聊天过程中得到的一些灵感，主要是关于直觉主义逻辑，经典逻辑，排中律的相关思考，还有一点对 Trebor 大佬写的 Chu Construction 的解读。又因为本人才学疏浅，完全不懂范畴论和哲学，所以解读都是瞎解的，希望读者不要信以为真。
>
> 代码都是 Idris 语言

## 你接受排中律吗？

众所周知，在直觉主义逻辑中 `lem : Either p (p -> Void)` 是没法证明的，这个类型所描述的定理在经典逻辑中是排中律，也就是经典逻辑的三大公理之一。这是直觉主义者会不接受排中律的理由。

某天我想在一个数学群玩一下这个梗，然后改群名片为「拒绝排中律从我做起」。很快就有人问为啥拒绝排中律，我当时说「因为排中律无法归纳构造」。这时候 Trebor 提醒我这样说不是很对，并给我扔了一篇纸（然而我并没有去看）。

## 如果接受排中律

这时候我就忽然想起了夏天在复习离散数学的时候做的一些直觉主义证明练习，当时有个命题证明不出来，于是我就去问 Trebor 如果加上双重否定消去（排中律在直觉主义逻辑中成立的前提）它是否能证明。

原命题是 $\neg \exists {a}. \neg p(a) \Rightarrow \forall {a}. p(a)$

Trebor 指出应当先证明它的逆否命题，然后就可以得到它你否命题的逆否命题，然后把双重否定消掉就好了：

```idris
proof0 : (((a : t) -> p a) -> Void) -> (((a : t ** p a -> Void) -> Void) -> Void)
proof0 f g = g (\(a ** npa) => f (\pa => npa (pa a)))

proof1 : ((a : t ** p a -> Void) -> Void) -> ((a : t) -> p a)
proof1 f = elimDoubleNeg ((contr proof0) (introDoubleNeg f))
```

更一般的说，根具[哥德尔双重否定翻译](https://ncatlab.org/nlab/show/double+negation+translation)可知任何经典逻辑命题加上双重否定后在直觉主义逻辑中都能被证明。比如上面这个命题：

```idris
proof2 : ((((a : t ** p a -> Void) -> Void) -> ((a : t) -> p a)) -> Void) -> Void
proof2 f = nnlem {p a} (\ lem => case lem of 
    Left pa => f (\ _ _ => pa)
    Right npa => f (\ g a => void (g (a ** npa))))
```

也就是说，经典逻辑实际上是直觉主义逻辑的子集。而且在上面这个例子中可以看到，加了双重否定以后就有办法利用排中律的双重否定可构造这个性质将排中律在局部引入。

## 直觉主义逻辑的世界

这么看来，直觉主义逻辑并不是完全不接受排中律，只是无法显式构造，因为我们确实并不能知道究竟是 `P` 成立还是 `P -> Void` 成立，没有「证据」就无法构造。不过我们还是能知道排中律*不是错的*，仔细观察这个定理：

```idris
nnlem : (Either p (p -> Void) -> Void) -> Void
nnlem f = f (Right (\p => f (Left p)))
```

如果有个经典逻辑命题 `q` 的证明 `qProof` 需要排中律，则可以像这样证明 `q` 的双重否定：

```idris
proof3 : (q -> Void) -> Void
proof3 f = nnlem (\lem => f (qProof lem))
```

这确实很合理，我们知道 `p` 和 `p -> Void` 里有一个是真命题，但我们并不知道究竟是哪一个，如果真证明出了我们岂不是能靠模式匹配凭空知道一个命题是不是真的。而 `nnlem` 用一个参数为排中律，返回值类型为 `Void` 的函数限制了 `lem` 的作用域。而且即使是在作用域里进行模式匹配，由于返回值类型为 `Void` 我们并不能从函数中掏出任何信息来，没有什么能从这个函数作用域中逃逸。从函数的外面来看就是用了排中律但仍然不知道命题 `p` 究竟是真是假。这样的性质无疑是和排中律最原始的描述非常相符，所以从某种角度来说我觉得拿 `nnlem` 当成直觉主义逻辑之下的排中律并无不妥。

## 计算性质

虽然用 `p -> Void` 来表示 `p` 是假命题非常符合直觉，但它有个比较头疼的问题：它没有任何计算性质。也就是说虽然我们能构造出函数把 `((p -> Void) -> Void) -> Void` 变成 `p -> Void` 但是并不能直接 unify 它们。不过呢，这可以被迂回解决，我们可以设计一个新类型来表示命题，这个新类型同时包含 `p` 和 `p -> Void` 和它们相悖的证据，而 not 只需要交换它们的位置就好。

```idris
record PProp where
    constructor MkPProp
    pos : Type
    neg : Type
    chu : pos -> neg -> Void

tight : Type -> PProp
tight p = MkPProp p (p -> Void) (\p n => n p)

not : PProp -> PProp
not q = MkPProp q.neg q.pos (\n p => q.chu p n)
```

[代码来源](https://gist.github.com/Trebor-Huang/6c5cd87fff8b50d23411a034c59daabb)

在 `PProp` 中 `pos` 作为当前的主命题 `neg` 作为与 `pos` 相悖的命题，而 `chu` 作为它们相悖的证据。我们可以通过 `tight` 函数将直觉主义逻辑命题变换进这个新的命题空间，而且可以用 `pos` 将其变回直觉主义逻辑命题。而且新的命题类型可以通过编译器的计算 unify `p` 和 `not (not p)`。

不仅如此，Trebor 指出 `pos` 和 `neg` 不一定需要其中一个是正确的，它们只需要不同时为 `Void` 就好。而在 `PProp` 之上建立的类型系统就是 Chu Construction 了。
