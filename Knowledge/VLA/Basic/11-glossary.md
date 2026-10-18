---
title: VLA 术语表（中英对照）
type: reference
topic: vla
chapter: 11
level: all
tags: [术语表, 词汇, 中英对照, VLA, 机器人学习]
prerequisites: []
estimated_time: 随查随用
status: draft
created: 2026-10-17
updated: 2026-10-17
---

# VLA 术语表（中英对照）

> 读论文时遇到不认识的词，先来这里查。每条给出一句话解释和它首次出现的章节。按主题分组，组内按字母序。

## 机器人学习基础

| 术语 | 英文 | 一句话解释 | 出现章节 |
|---|---|---|---|
| 策略 | Policy | 从观察到动作的映射函数 $\pi(a\|s)$ | [01](01-what-is-robot-learning.md) |
| 模仿学习 | Imitation Learning (IL) | 从人类示范数据中监督学习策略 | [01](01-what-is-robot-learning.md) |
| 强化学习 | Reinforcement Learning (RL) | 通过试错和奖励信号学习策略 | [01](01-what-is-robot-learning.md) |
| 泛化 | Generalization | 在训练未见过的物体 / 场景 / 指令上仍能工作 | [01](01-what-is-robot-learning.md) |
| 遥操作 | Teleoperation | 人远程控制机器人完成任务，同时录制数据 | [06](06-datasets-and-data-collection.md) |
| 主从臂 | Leader-follower arm | 人拖动小臂，机器人大臂同步跟随的遥操作设备 | [06](06-datasets-and-data-collection.md) |
| 本体状态 | Proprioception | 机器人自身的关节角、末端位姿、夹爪开度 | [04](04-vla-concept.md) |
| 跨本体 | Cross-embodiment | 一个模型 / 数据集覆盖多种机器人 | [05](05-representative-models.md) |
| 轨迹 / 回合 | Episode / Trajectory | 一次完整任务示范的全部帧 | [06](06-datasets-and-data-collection.md) |
| 成功率 | Success rate | N 次试验中成功的比例 | [09](09-evaluation-and-deployment.md) |
| 仿真到真机差距 | Sim-to-real gap | 仿真中好用、真机上失效的差距 | [09](09-evaluation-and-deployment.md) |

## 深度学习

| 术语 | 英文 | 一句话解释 | 出现章节 |
|---|---|---|---|
| 参数 / 权重 | Parameters / Weights | 神经网络中可训练的数字 | [02](02-deep-learning-essentials.md) |
| 损失函数 | Loss function | 衡量预测与真实值差距的函数 | [02](02-deep-learning-essentials.md) |
| 梯度下降 | Gradient descent | 沿梯度反方向更新参数以减小损失 | [02](02-deep-learning-essentials.md) |
| 学习率 | Learning rate | 每步参数更新的步长 | [02](02-deep-learning-essentials.md) |
| 批大小 | Batch size | 每次梯度计算使用的样本数 | [08](08-training-and-finetuning.md) |
| 过拟合 | Overfitting | 模型记住训练数据细节、泛化变差 | [02](02-deep-learning-essentials.md) |
| 显存 | VRAM / GPU memory | GPU 上存放参数和中间结果的内存 | [02](02-deep-learning-essentials.md) |
| 混合精度 | Mixed precision (bf16/fp16) | 用低精度浮点加速训练并省显存 | [02](02-deep-learning-essentials.md) |
| 预训练 | Pre-training | 在大规模通用数据上的初始训练 | [08](08-training-and-finetuning.md) |
| 微调 | Fine-tuning | 在目标任务数据上继续训练 | [08](08-training-and-finetuning.md) |
| 低秩适配 | LoRA | 冻结原权重，只训练低秩增量矩阵的微调方法 | [08](08-training-and-finetuning.md) |
| 灾难性遗忘 | Catastrophic forgetting | 微调时丢失预训练学到的能力 | [08](08-training-and-finetuning.md) |
| 梯度检查点 | Gradient checkpointing | 不保存中间激活、反向时重算，以时间换显存 | [08](08-training-and-finetuning.md) |
| 量化 | Quantization | 用 int8 / int4 存储权重以减少显存、加速推理 | [09](09-evaluation-and-deployment.md) |

## Transformer 与多模态

| 术语 | 英文 | 一句话解释 | 出现章节 |
|---|---|---|---|
| 词元 | Token | 模型处理的最小单位（词片段或图像块） | [03](03-transformers-and-multimodal.md) |
| 嵌入 | Embedding | token 对应的固定维度向量 | [03](03-transformers-and-multimodal.md) |
| 注意力 | Attention | 让每个 token 按相关性加权参考其他 token | [03](03-transformers-and-multimodal.md) |
| 自注意力 | Self-attention | 序列内部 token 之间的注意力 | [03](03-transformers-and-multimodal.md) |
| 视觉 Transformer | ViT | 把图片切块后用 Transformer 处理 | [03](03-transformers-and-multimodal.md) |
| 图像块 | Patch | ViT 中切出来的图像小块 | [03](03-transformers-and-multimodal.md) |
| 对比学习 | Contrastive learning | 让匹配的图文向量靠近、不匹配的远离 | [03](03-transformers-and-multimodal.md) |
| CLIP / SigLIP | — | 图文对齐的视觉编码器 | [03](03-transformers-and-multimodal.md) |
| DINOv2 | — | 自监督训练的视觉编码器，几何细节强 | [03](03-transformers-and-multimodal.md) |
| 大语言模型 | LLM | 预测下一个 token 的大型 Transformer | [03](03-transformers-and-multimodal.md) |
| 视觉语言模型 | VLM | 能同时输入图像和文字的 LLM | [03](03-transformers-and-multimodal.md) |
| 投影层 | Projector | 把视觉特征映射到 LLM 嵌入空间的小网络 | [03](03-transformers-and-multimodal.md) |
| 骨干 | Backbone | 模型主体，VLA 中通常是预训练 VLM | [05](05-representative-models.md) |
| PaliGemma | — | SigLIP + Gemma 2B 的 VLM，π0 的骨干 | [03](03-transformers-and-multimodal.md) |

## VLA 专属

| 术语 | 英文 | 一句话解释 | 出现章节 |
|---|---|---|---|
| 视觉-语言-动作模型 | VLA | 输入图像 + 语言 + 状态，输出动作的模型 | [04](04-vla-concept.md) |
| 动作 | Action | 下一时刻的控制目标向量 | [04](04-vla-concept.md) |
| 动作块 | Action chunk | 一次预测的未来多步动作 | [04](04-vla-concept.md) |
| 动作分块 | Action chunking | 一次输出一段动作的技术 | [04](04-vla-concept.md) |
| 时间集成 | Temporal ensembling | 重叠的动作块加权平均以平滑衔接 | [04](04-vla-concept.md) |
| 离散动作 token | Discrete action token | 把连续动作分 bin 后当词表 token | [04](04-vla-concept.md) |
| 自回归 | Autoregressive | 逐个生成 token，每个依赖前面的 | [04](04-vla-concept.md) |
| 扩散策略 | Diffusion policy | 从噪声逐步去噪生成动作 | [04](04-vla-concept.md) |
| 流匹配 | Flow matching | 学习从噪声到数据的速度场，扩散的高效变体 | [04](04-vla-concept.md) |
| 动作专家 | Action expert | π0 中专门生成动作的 Transformer 分支 | [04](04-vla-concept.md) |
| 动作头 | Action head | VLM 之后专门输出动作的模块 | [04](04-vla-concept.md) |
| 混合专家 | Mixture of Experts (MoE) | 多个子网络由路由器动态选择 | [10](10-force-and-tactile-sensing.md) |
| 归一化统计量 | Normalization stats | 动作 / 状态各维的均值、方差、分位数 | [07](07-action-representation.md) |
| 增量动作 | Delta action | 相对当前位置的变化量 | [07](07-action-representation.md) |
| 关节空间 | Joint space | 用关节角描述姿态 | [07](07-action-representation.md) |
| 末端空间 / 笛卡尔空间 | End-effector / Cartesian space | 用末端位姿描述 | [07](07-action-representation.md) |
| 位姿 | Pose | 位置 + 朝向 | [07](07-action-representation.md) |
| 逆运动学 | Inverse Kinematics (IK) | 从末端位姿反算关节角 | [07](07-action-representation.md) |
| 推理延迟 | Inference latency | 从输入到输出动作的时间 | [09](09-evaluation-and-deployment.md) |
| 推理服务器 | Policy server | 运行模型、通过网络返回动作的进程 | [09](09-evaluation-and-deployment.md) |

## 数据集与基准

| 术语 | 英文 | 一句话解释 | 出现章节 |
|---|---|---|---|
| Open X-Embodiment | OXE | 22 种机器人、100 万+ 轨迹的跨本体数据集合 | [06](06-datasets-and-data-collection.md) |
| BridgeData V2 | — | WidowX 单臂、约 6 万轨迹、场景多样 | [06](06-datasets-and-data-collection.md) |
| DROID | — | Franka、约 7.6 万轨迹、564 个真实场景 | [06](06-datasets-and-data-collection.md) |
| LeRobot | — | Hugging Face 的开源机器人学习库和数据格式 | [06](06-datasets-and-data-collection.md) |
| RLDS | Reinforcement Learning Datasets | OXE 使用的 TensorFlow 数据格式 | [06](06-datasets-and-data-collection.md) |
| LIBERO | — | 基于 robosuite 的仿真评估基准 | [09](09-evaluation-and-deployment.md) |
| SimplerEnv | — | 复现真机场景的仿真评估环境 | [09](09-evaluation-and-deployment.md) |

## 力觉与控制

| 术语 | 英文 | 一句话解释 | 出现章节 |
|---|---|---|---|
| 接触丰富任务 | Contact-rich task | 关键阶段需持续接触、受力的任务 | [10](10-force-and-tactile-sensing.md) |
| 六维力 / 力矩传感器 | 6-axis F/T sensor | 测 3 方向力 + 3 方向力矩的腕部传感器 | [10](10-force-and-tactile-sensing.md) |
| 触觉传感器 | Tactile sensor | 指尖接触面压力 / 形变感知 | [10](10-force-and-tactile-sensing.md) |
| 阻抗控制 | Impedance control | 让机器人表现为虚拟弹簧-阻尼 | [10](10-force-and-tactile-sensing.md) |
| 导纳控制 | Admittance control | 测力后换算成位置修正 | [10](10-force-and-tactile-sensing.md) |
| 刚度 | Stiffness | 阻抗控制中的弹簧系数 $K$ | [10](10-force-and-tactile-sensing.md) |
| 重力补偿 | Gravity compensation | 从力传感器读数中去除工具自重 | [10](10-force-and-tactile-sensing.md) |
| 急停 | Emergency stop (E-stop) | 切断机器人动力的物理按钮 | [09](09-evaluation-and-deployment.md) |
| 看门狗 | Watchdog | 超时未收到指令即自动停机的机制 | [09](09-evaluation-and-deployment.md) |
| 背驱 | Backdrivable | 可以用手推动关节、电机不阻碍的机械特性 | [10](10-force-and-tactile-sensing.md) |

> 🔗 关联：ForceVLA 专属术语（FVLMoE、ForceVLA-Data 等）见 [ForceVLA 论文专题](../ForceVLA/00-README.md)；世界模型术语（RSSM、JEPA、想象 rollout 等）见 [WAM 世界模型](../../WAM/00-README.md)。
