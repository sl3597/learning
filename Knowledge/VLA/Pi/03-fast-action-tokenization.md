---
title: FAST：把高频动作压缩成 token（π0-FAST）
type: tutorial
topic: vla
chapter: 3
level: intermediate
tags: [FAST, π0-FAST, 动作token化, DCT, BPE, 自回归VLA, DROID]
prerequisites: [02-pi0-architecture-and-flow-matching]
estimated_time: 50min
sources:
  - https://arxiv.org/abs/2501.09747
  - https://www.pi.website/research/fast
  - https://huggingface.co/physical-intelligence/fast
status: draft
created: 2026-10-19
updated: 2026-10-19
---

# FAST：把高频动作压缩成 token（π0-FAST）

> π0 用流匹配生成连续动作，效果好但训练慢；RT-2 / OpenVLA 那种"把动作当文字"的自回归路线训练简单，却在 50 Hz 的高频灵巧任务上完全学不会。这一章讲 Physical Intelligence 怎么用一个"动作压缩器"FAST 让自回归路线也能做叠衣服，并理解它付出了什么代价。

## 学习目标

- 能用"相邻动作几乎一样 → 下一个 token 没有信息"解释为什么逐步 binning 在高频数据上失效
- 能按顺序说出 FAST 的五个步骤，并说明 DCT 和 BPE 各自负责压缩什么
- 能用三行代码调用 FAST+ 通用 tokenizer，知道它适合什么输入
- 能比较 π0 与 π0-FAST 在训练速度、推理延迟、语言跟随上的取舍，并据此为自己的任务选型

## 前置知识

- 需要先读：[02 π0 架构与流匹配](02-pi0-architecture-and-flow-matching.md)、[VLA 基础 07 动作表示](../Basic/07-action-representation.md)（7.3 节的分位数归一化、7.4 节的 256 bin 离散化是本章的"对照组"）

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **动作 token 化**（action tokenization） | 把一段连续动作数值变成一串离散符号，让语言模型能"说"出动作 | 把一条曲线翻译成一句话 |
| **朴素 binning** | 每个时间步、每个维度各自切成 256 个区间，一个区间一个 token | 把曲线上每个点都逐一念出坐标 |
| **DCT**（离散余弦变换） | 把一段信号拆成"不同快慢的余弦波之和"，平滑信号只需少数低频系数 | JPEG 压缩图片用的就是它 |
| **量化**（quantization） | 系数乘一个缩放系数后取整，小系数变成 0 | 把 0.03 元的零头抹掉 |
| **BPE**（字节对编码） | 把频繁一起出现的符号合并成新符号，压短序列 | 输入法把"北京市"记成一个词 |
| **自回归解码** | 一个 token 一个 token 地往后生成，每步都要跑一次模型 | 逐字打字，而不是一次画出整条曲线 |

## 详细讲解

### 3.1 为什么逐步 binning 在高频数据上失效

自回归模型学的是"给定前面所有 token，预测下一个 token"。它的学习信号大小和**下一个 token 相对前文的新信息量**成正比。动作是平滑信号：控制频率越高、时间步越短，相邻两步的差别就越小，当每一步都单独切成 256 个 bin 时，下一个 token 几乎总是和上一个相同。模型发现"照抄上一步"就能把损失压得很低，于是停在这个糟糕的局部最优上。

论文用一个玩具实验验证了这一点：让小 Transformer 根据 4 个随机点预测穿过它们的三次样条曲线，同一条曲线按 25 到 800 个采样点分别 token 化。采样率低时误差很小，升高后误差陡增，最后模型干脆复制第一个动作——数据没变，变的只是 token 化方式。现实对应：OpenVLA 在 5 Hz 的 BridgeV2 上不错，却难以拟合 15 Hz 的 DROID。

> 💡 要点：问题不在"离散 token 表达不了精细动作"，而在"相邻 token 太像，没什么可学的"。解法是先**压缩**，把冗余去掉，让每个 token 都携带信息。

### 3.2 FAST 的五个步骤

FAST（Frequency-space Action Sequence Tokenization）处理的是一个 1 秒的动作块（action chunk），比如 50 Hz × 14 维的双臂动作就是一个 50×14 的矩阵。

```text
归一化后的动作块 (50 步 × 14 维)
      │ ① 每维按 1%/99% 分位数缩放到 [-1, 1]
      │ ② 每一维单独做 DCT  → 50 个频率系数，低频大、高频小
      │ ③ 系数 × 缩放系数 γ 后四舍五入 → 大部分变成 0（稀疏矩阵）
      │ ④ 按"先所有维度的最低频、再次低频…"的顺序展平成一串整数
      │ ⑤ 对这串整数做 BPE → 零被"吸收"，常见组合合并
      ▼
约 30~60 个动作 token
```

1. **分位数归一化**：用 1% 和 99% 分位数而不是最小/最大值，离群动作不会把范围撑大；也让不同机器人、不同量纲的动作落在同一区间。
2. **逐维 DCT**：低频系数描述整体走势，高频系数描述突变。平滑的机器人动作几乎只有低频系数显著。
3. **缩放 + 取整**：缩放系数 γ 是唯一需要选的"有损"旋钮，越大越保真、token 越多；论文所有单数据集实验都用 γ = 10。
4. **低频优先展平**：先列出所有维度的最低频系数，再列次低频，让模型在自回归生成时先定"大形状"再补细节，论文发现这样 rollout 更稳定。
5. **BPE**：唯一需要训练的部件，词表大小 1024，几分钟就能在新数据集上训好。没有 BPE 时序列里会有大量重复的 0，稀释学习信号、拖慢推理。

每一步都可逆，所以预测出的 token 能快速解码回连续动作。压缩效果（论文表 I，1 秒块的平均 token 数）：

| 数据集 | 动作维度 | 频率 | 朴素 binning | FAST | 压缩比 |
|---|---|---|---|---|---|
| BridgeV2 | 7 | 5 Hz | 35 | 20 | 1.75× |
| DROID | 7 | 15 Hz | 105 | 29 | 3.6× |
| 收拾桌子 | 7 | 20 Hz | 140 | 28 | 5.0× |
| 叠 T 恤 | 14 | 50 Hz | 700 | 53 | 13.2× |

> 🔍 深入：有意思的规律是，无论频率多高，FAST 每个机械臂每秒都约 30 个 token（双臂约 60 个）。这说明它抓住的是动作本身的复杂度，而不是采样率。

### 3.3 FAST+：开箱即用的通用 tokenizer

BPE 词表要按数据集训练，总归是个麻烦。于是作者在约 100 万个 1 秒动作块上训练了通用版 **FAST+**，数据覆盖单臂、双臂、移动机器人，关节空间和末端空间，多种控制频率；所有动作先补零到 32 维。在从未见过的机器人数据（灵巧手、人形机器人、UMI 等）上，它仍能把 token 数至少压缩一半；用于训练策略时效果和按数据集定制的 tokenizer 相当。

```python
from transformers import AutoProcessor

tokenizer = AutoProcessor.from_pretrained("physical-intelligence/fast", trust_remote_code=True)
tokens = tokenizer(action_chunk)          # 输入：归一化到 [-1, 1] 的 1 秒动作块
new_tokenizer = tokenizer.fit(action_dataset)  # 可选：在自己的数据上重新训练 BPE
```

> ⚠️ 注意：官方建议先做分位数归一化、并按 1 秒的块来 token 化，否则压缩率会明显变差。

### 3.4 π0-FAST：同一个骨干，换成"说"动作

π0-FAST 用和 π0 完全相同的 PaliGemma-3B 骨干与同一套 10k 小时跨机器人数据，区别只有输出端：不再接 300M 的动作专家做流匹配，而是像 RT-2 / OpenVLA 那样用 FAST token 覆盖词表中最少用的 token，由语言模型自回归地"说"出动作，再解码成连续值。机器人本体状态作为输入时仍用简单的 256 bin 文本化即可，因为输入端不存在"预测冗余 token"的问题。

| | π0（流匹配） | π0-FAST（自回归） |
|---|---|---|
| 输出模块 | 300M 动作专家，10 步去噪 | 2B 语言模型骨干逐 token 解码 |
| 训练成本 | 基准 | GPU 小时数少 5 倍（大数据集上收敛快 3 倍） |
| 推理延迟（RTX 4090，1 秒动作块） | 约 100 ms | 约 750 ms（要解码 30~60 个 token） |
| 语言跟随 | DROID 上常忽略指令 | 更贴合指令 |
| 需要改骨干吗 | 要新增动作专家 | 不改任何结构，任何自回归 Transformer 都能用 |

> 💡 要点：FAST 买到的是**训练效率和语言跟随**，付出的是**推理速度**。静态桌面任务里 750 ms 可以接受，高动态任务就不行；论文把加速（投机解码、量化等）留给了未来工作。

### 3.5 实验结果

- **7 个评测任务**：LIBERO 仿真，以及收拾桌子（UR5，20 Hz）、叠 T 恤（双臂 ARX，50 Hz）、装杂货袋（UR5，20 Hz）、取吐司（双臂 Trossen，50 Hz）、从篮子里叠衣服（双臂 ARX，50 Hz）、DROID 零样本桌面操作（15 Hz）。
- **tokenizer 对比**：朴素 binning 在 20 Hz 的收拾桌子和 50 Hz 的叠 T 恤上完全无法推进任务；FAST 与学习式压缩 FSQ 相当或更好，且不用训练额外网络；FAST+ 追平定制版。
- **换骨干也有效**：把 OpenVLA 改成多图输入 + 1 秒块，用 FAST+ 替换它原来的 binning，叠 T 恤性能显著提升。
- **DROID 零样本**：在 75k 条成功轨迹上训练 3 个 epoch（8×H100 约 4 天），得到第一个无需微调、靠自然语言提示就能在全新场景工作的 DROID 策略，并在伯克利、斯坦福、华盛顿大学三个校园测试，能完成取放、开关柜门、开水龙头等简单任务。
- **通用策略**：在 π0 的完整混合数据（9.03 亿时间步自有数据 + 9.1% 开源数据）上训练的 π0-FAST，在包括叠衣服在内的任务上追平流匹配 π0。

### 3.6 和 ForceVLA 的联系

[ForceVLA 的实验](../ForceVLA/05-experiments-and-results.md)把 π0-base 和 π0-fast 都当基线：π0-fast 不但不如 π0-base，加了力输入后反而更差（31.0% → 14.2%）。一种可能的解释是接触任务需要快速的力反馈，而自回归解码一个动作块要数百毫秒。这只是推测，两篇论文都没有分析原因。

> 🔗 关联：π0.5 的训练配方把两条路线合起来用——先用 FAST token 做预训练，再加流匹配动作专家做后训练，见 [04 π0.5 与知识隔离](04-pi05-open-world-and-knowledge-insulation.md)。

## 动手练习

1. 用 numpy 生成一段 50 步、平滑变化的一维"动作"（比如正弦叠加小噪声），分别做：(a) 256 bin 离散化，统计相邻 token 相同的比例；(b) `scipy.fft.dct` 后乘 10 取整，统计非零系数个数。验收标准：说出两种表示各自需要多少个"有信息的"符号。

<details><summary>参考做法</summary>

```python
import numpy as np
from scipy.fft import dct

t = np.linspace(0, 1, 50)
a = np.sin(2 * np.pi * t) * 0.8 + np.random.randn(50) * 0.01
bins = np.digitize(a, np.linspace(-1, 1, 257)) - 1
same = np.mean(bins[1:] == bins[:-1])          # 相邻 token 相同的比例，通常很高
coef = np.round(dct(a, norm="ortho") * 10)
nonzero = np.count_nonzero(coef)               # 通常只有个位数
print(same, nonzero)
```
</details>

2. 安装 `transformers`，用 FAST+ 对上面的动作块（补成 `a[None, :, None]`）做 token 化再解码，比较重建误差。

<details><summary>参考做法</summary>

`tokenizer(a[None, :, None])` 返回 token 列表；`tokenizer.decode(tokens, time_horizon=50, action_dim=1)` 重建。参数名以 HuggingFace 仓库 README 为准。
</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| 自回归 VLA 训练损失很低，真机却一动不动 | 高频数据 + 逐步 binning，模型学会了复制上一步 | 换 FAST / FAST+，或降低数据采样率 |
| FAST+ 压缩率比论文差很多 | 没做分位数归一化，或动作块不是 1 秒 | 先归一化到 [-1, 1]，按 1 秒切块 |
| 部署后机器人动作"一卡一卡" | 自回归解码每块约 750 ms，远慢于流匹配 | 开环执行整块动作；对延迟敏感的任务改用 π0 流匹配版 |
| 把本体状态也用 FAST 编码 | 状态是输入不是输出，不需要压缩 | 状态用 256 bin 文本化即可 |

## 小结

- 逐步 binning 在高频数据上失效，根因是相邻 token 信息量趋近于零。
- FAST = 分位数归一化 → 逐维 DCT → 缩放取整 → 低频优先展平 → BPE，每个 1 秒块约 30~60 个 token，最高压缩 13 倍。
- FAST+ 是在 100 万个动作块上训好的通用 tokenizer，三行代码可用。
- π0-FAST 训练快 5 倍、语言跟随更好，但推理约 750 ms/块，比流匹配 π0 慢得多。
- 选型：数据多、重语言理解、静态任务选 π0-FAST；要高频闭环就选 π0。

## 自测题

1. 为什么把控制频率从 5 Hz 提到 50 Hz 后，同样的 binning 自回归模型反而学不会了？

<details><summary>答案</summary>频率越高，相邻动作差别越小，逐步 binning 后下一个 token 几乎总等于上一个，学习信号（边际信息量）趋近于零，模型陷入"复制上一步"的局部最优。</details>

2. FAST 的五步里哪一步是有损的？哪一步需要训练？

<details><summary>答案</summary>有损的是"缩放后取整"（由缩放系数 γ 控制保真度）；需要训练的只有 BPE 词表。DCT、展平、BPE 编码本身都是可逆的。</details>

3. 一个需要 20 Hz 闭环反应的接触任务，应该选 π0 还是 π0-FAST？为什么？

<details><summary>答案</summary>选 π0。π0-FAST 每个动作块要自回归解码 30~60 个 token，RTX 4090 上约 750 ms，无法满足高频闭环；π0 流匹配约 100 ms。</details>

## 参考资料

- [FAST 论文（arXiv 2501.09747）](https://arxiv.org/abs/2501.09747) —— 第 IV 节的玩具实验和第 V-B 节的算法描述最值得精读
- [Physical Intelligence 博客：FAST](https://www.pi.website/research/fast) —— 带动画的五步示意
- [FAST+ tokenizer（HuggingFace）](https://huggingface.co/physical-intelligence/fast) —— 通用 tokenizer 权重与 `fit` 用法
- [本专题论文笔记：FAST](../../Papers/VLA/03-fast.md) —— 完整的实验表格与待核实项
- [openpi 代码库（GitHub）](https://github.com/Physical-Intelligence/openpi) —— `pi0_fast_base` 与 `pi0_fast_droid` 检查点
