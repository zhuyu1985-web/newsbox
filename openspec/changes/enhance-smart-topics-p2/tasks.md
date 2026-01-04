## 1. Implementation
- [x] 1.1 数据库：扩展 `knowledge_topics`（置顶/归档/封面/统计/更新时间字段）
- [x] 1.2 数据库：扩展 `knowledge_topic_members`（人工状态/事件时间/指纹/证据排序）
- [x] 1.3 数据库：新增 `knowledge_topic_events`（事件节点聚合）+ RLS
- [x] 1.4 后台：实现 Timeline Engine（event time 抽取、fingerprint、节点聚合与重要性）
- [x] 1.5 后台：实现 DBSCAN/HDBSCAN 聚类（含增量策略与参数自适应）
- [x] 1.6 后台：实现命名/关键词/报告重写（prompt + 成本控制 + 缓存）
- [x] 1.7 API：新增合并/移入移出/置顶归档/报告生成 endpoints
- [ ] 1.8 前端：专题列表升级（卡片、New、置顶、归档折叠、拖拽合并）
- [ ] 1.9 前端：专题详情升级（Hero 报告、时间轴节点、节点内证据、视频预览）
- [ ] 1.10 前端：右键/菜单人机协作（加入/移出/确认归类/纠错时间）
- [ ] 1.11 定时任务：每日 2:00 自动增量刷新（Scheduled Edge Function）

## 2. Validation
- [ ] 2.1 RLS：跨用户访问/写入验证
- [ ] 2.2 性能：200/1000/5000 notes 的生成与刷新耗时评估
- [ ] 2.3 质量：聚类过细/过粗、噪声点比例、手动合并后的稳定性
- [ ] 2.4 成本：embedding + LLM 调用预算与限流策略

## 3. Rollout
- [ ] 3.1 Feature flag：允许按用户灰度开启 P2 功能
- [ ] 3.2 观测：记录生成耗时、错误率、用户操作漏斗（生成→查看→导出/复制）
