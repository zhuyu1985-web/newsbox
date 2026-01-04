# Change: Enhance Smart Topics (P2/P3 专题叙事重构 + 人工可控)

## Why
当前 P1 的“智能专题”已能把用户全库笔记聚类成 topic，并提供列表/时间线/报告，但对媒体人/深度阅读者而言仍存在关键缺口：

- **叙事线索不足**：仅按 `published_at/created_at` 排序，无法反映“事件发生时间”，也无法把同一事件的多篇报道合并成“一个节点”。
- **人机协作缺失**：聚类难免过细/过粗，缺少“移出/加入/合并/确认归类”等编辑能力，会让用户对专题失去信任。
- **生命周期与跟进体验不足**：缺少“置顶/新内容红点/自动归档”等机制，难以支持持续追踪与长期回看。
- **跨专题线索缺失**：同一人物/机构跨专题出现时，没有提供“线索跳转/关系提示”。

本变更将把 Smart Topics 从“自动聚类结果展示”提升为“**碎片信息 → 结构化叙事**”的工作台。

## What Changes
### Product (用户可见)
- **专题列表（Topic Gallery）**升级
  - 卡片化信息密度：标题、条目数、跨度、关键实体、更新状态（New）
  - **置顶**、**归档折叠**、**合并专题**（拖拽/批量选择）
- **专题详情（Topic Detail）**升级为“总-分”结构
  - 顶部 Hero：可生成/重写的 **AI 综述报告（Markdown）**，支持复制/导出
  - 中部：**智能时间轴**（按“事件发生时间”组织）
    - 节点去重（同一事件多篇合并）
    - 重要节点强调（大节点/小节点）
    - 视频节点可预览（若为视频类型 note）
  - 右侧：**Mini Graph（缩略知识图谱）**（P3）
- **Human-in-the-loop**（人工干预）
  - 右键/菜单：加入专题、移出专题、标记“确认归类”（pin）、纠正时间轴节点

### Backend (系统能力)
- 聚类引擎从 P1 的 K-Means 提升为 **DBSCAN/HDBSCAN**（更适配未知主题数量与噪声点）
- 新增 **Timeline Engine**：提取“事件发生时间”与“事件指纹”，支持去重合并
- 新增 **Topic Lifecycle**：非置顶且 30 天无新增自动归档
- 新增 **Cross-Reference**（P3）：实体抽取与跨专题引用提示

## Scope
- P2：DBSCAN 聚类、事件时间轴、去重节点、人机协作（加入/移出/合并/确认归类）、生命周期
- P3：实体关系抽取、Mini Graph、跨专题线索发现

## Out of Scope
- 跨用户共享/协作专题
- 复杂可视化图谱编辑器（仅缩略预览与跳转）
- 强实时（每次收藏立刻聚类）；本阶段以“定时 + 手动”触发为主

## Impact
- Affected specs:
  - `knowledge-base`：Smart Topics 的行为、交互与数据契约将显著扩展
- Affected code:
  - `app/api/knowledge/topics/*`：新增/增强 API（合并、手动调整、生命周期）
  - `components/dashboard/knowledge-view.tsx`：专题列表与详情交互升级
  - `supabase/migrations/*`：新增 topic/member/event/entity 相关字段与表

## Risks / Trade-offs
- **计算成本**：DBSCAN/HDBSCAN 对样本量敏感，需要增量策略、分页处理、限流与缓存。
- **Deno 环境限制**：Supabase Edge Functions 运行时对部分 Node 原生库不友好；需选择 Deno 兼容的聚类实现或引入 worker。
- **质量可解释性**：需要可视化解释（代表条目、关键词、为什么归类）与人工可控能力缓解。

## Success Metrics
- 专题列表的日常使用：置顶专题打开率、New 标记点击率
- 专题详情消费：报告复制/导出次数、时间轴节点点击跳转次数
- 人工干预后稳定性：合并/移入/移出后的二次调整率降低
