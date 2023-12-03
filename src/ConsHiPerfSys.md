# 构建高性能系统：从单线程到分布式

> 写了一半以后，停了半年再回来看感觉当年真是年轻……先放着吧（

### 前言

「高并发」、「分布式」、「可缩放」听着是多么地顺耳。对于年幼时期的我来说，构建一个高性能系统就是一个遥不可及的梦。且不说如何设计架构，那时我的代码能力完全撑不起大型项目。不过随着时间流逝，我也有所成长，而碰巧去年有个课设就要求设计一个高并发后台。这是个很好的机会，我想着一不做二不休，决定干票大的，直接把分布式一起实践了。不得不说这些年能力确实有提升，这个项目也持续推进下去了。不过因为第一次构建这样的复杂工程，碰到颇多坑。又联想到之前找相关资料的困难，便有了这篇文章。当然，这篇文章性质更接近一个 Introduction，偏向介绍什么时候会用到什么技术以及为什么，至于具体的每种技术的细节可以去查询其他资料啦。

## 从单线程开始

设想一个最简单的例子：Key-Value 数据库。服务器接收请求，并通过 Key 查询 Value 或者修改一对给定的 Key-Value。一个单线程的程序当然可以完成这个任务，不断循环或者使用 Epoll 获取请求，然后用自己写的或者是每个语言都有的 Map 类索引 Key 再处理 Value，并且每隔一段时间将内存数据写回到硬盘中。至于 Map 用什么实现，不同实现各有优缺点：Hash 表性能好但是占空间大、红黑树能范围查询但是 Key 的比较可能成本比较高……所以需要自己权衡。不过最后落实到实现上，这些不同实现经过优化的性能最多差一个数量级。

通过简单计算可以知道对于 3GHz 的单个核心来说，如果平均 Key 长度为 30 则一个良好的 Key-Value 数据库的 QPS 根据具体数据规模的不同大约在一百万到一千万之间。实际上我们可以查到作为单线程的 Redis，其 QPS 大概就是一百万，而且它还支持很多复杂操作。

但是这个简单系统在面对增长的规模很快就会暴露其问题：首当其冲的就是随着其存储的数据量增加，写回到硬盘所需的时间会越来越长，导致每到写回的时候其端到端延迟就会忽然变长；而且数据量增加到一定程度就会达到内存上限，若是启用 Swap 来缓解内存压力那么当 Key 索引被换页到硬盘后更是会影响延迟。很容易想到将 Value 始终放在硬盘上并引入缓存来缓解内存压力，而缓存策略又是个大坑，没处理好会大大影响 QPS，而且尤其容易影响修改性能。

所以虽然听着一百万 QPS 很多，但其实纯单线程很多时候达不到这个数的。不过世界上大部分服务都不需要一百万 QPS 就是说。另外这个应用最大的单机压力其实来自硬盘而不是算力，不过更多时候分布式系统会有更复杂的逻辑伴随着更多的算力需求，所以接下来介绍优化思路时还是会把 QPS 当作指标之一。

> 覆盖：缓存、分块、所有权、读写分离

## 充分利用每个核心

熟悉 Redis 的小伙伴看到上面提到的第一个问题很容易想到可以利用 fork 的 Copy on Write 性质来优化：需要缓存时 fork 一下，父进程处理继续处理，子进程把锁定的堆写回到硬盘上。不过真测试过的小伙伴也会知道这个方案只能缓解阻塞，并不能完全解决。首先是当堆很大的时候 fork 本身就会阻塞比较长的时间（百毫秒以上），其次如果有巨量修改请求那么就会频繁触发 CoW 中 Write 时的 Copy，每次操作系统都会把需要修改的只读页复制一下，会非常影响性能。另一个 Redis 中的优化思路是 AOF，也就是写回采用日志格式，每次把修改附加到文件最后，这种情况下很容易想到可以单独开一个线程专门负责日志的写入。当然 AOF 的问题就是重启服务时回放可能需要较长时间，不过日志文件也能定期重写所以启动时间还算可控。

如果恰巧内存很多的话写回硬盘倒是有另一个简单粗暴的方案：开两个线程跑同样的服务接收相同的请求，但是其中一个不会写回硬盘而专心负责请求响应而另一个不需要响应请求所以允许写回阻塞，期间的修改操作等写回结束再继续处理，通过分离阻塞操作来保证可用性。而这个方案的进阶版就要动用数据结构知识，使用一些可持久化数据结构，每次修改不影响之前的数据，写回的时候开启一个线程从当时的版本读取，并不会阻塞后续的修改操作。这个方案在优化良好且内存充足的情况下可以几乎不降低 QPS 只用两核搞定写回阻塞问题，算是非常经济的一个方案了。

充分利用 CPU 资源的另一个思路就是**流水线**

## 当规模超越单机极限