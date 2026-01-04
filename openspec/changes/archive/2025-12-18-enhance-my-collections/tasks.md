## 1. Research & Data Model
- [x] 1.1 审核 notes/folders/tags 表结构，确认是否已有星标、今日筛选所需字段，缺失则在后续任务中设计迁移
- [x] 1.2 评估 Supabase Storage 配额及安全策略，确认上传图片/视频/文件的桶和访问策略

## 2. Category Navigation & Smart Lists
- [x] 2.1 为 API/SQL 查询添加未分类、所有、星标、今日、收藏夹过滤参数及计数
- [x] 2.2 设计智能列表聚类算法（按标签、来源、关键字等），并暴露查询接口
- [x] 2.3 更新前端侧边栏与状态保持，支持点击分类后联动展示对应列表

## 3. Listing & Pagination
- [x] 3.1 在 notes 列表接口实现基于 created_at/id 的滑动分页（limit/offset 或 cursor）
- [x] 3.2 前端实现无限滚动或“加载更多”行为，包含加载中/无更多提示
- [x] 3.3 确保分页在切换分类、搜索、标签、收藏夹后自动重置并重新拉取

## 4. Note Operations (单个)
- [x] 4.1 实现打开原文、复制原文链接操作
- [x] 4.2 实现复制内容：纯文本、Markdown、HTML 三种格式（含富文本转化）
- [x] 4.3 实现导出到本地：txt、Markdown、HTML 文件打包并触发下载
- [x] 4.4 添加 API/服务以星标/取消星标、移动到收藏夹、设置标签、归档、删除

## 5. Bulk Operations
- [x] 5.1 设计批量选择交互（多选、全选、取消）
- [x] 5.2 后端支持批量操作接口（星标、移动、标签、归档、删除、导出、复制链接/内容）
- [x] 5.3 处理失败和部分成功的反馈（toast/错误提示）

## 6. Creation Entry (网址/速记/上传)
- [x] 6.1 更新 capture API 以支持速记文本（无需 URL）并写入 notes/content_html
- [x] 6.2 新建上传 API：接收图片/视频/文件 -> Supabase Storage -> 生成 note/media 记录
- [x] 6.3 在“添加笔记”入口提供 URL、速记、上传三种 tab/tabbed UI，并复用验证逻辑

## 7. Validation & QA
- [x] 7.1 编写单元/集成测试（filters、分页、批量操作、导出、上传）
- [x] 7.2 手动验证微信公众号图片、无限滚动与批量操作在移动/桌面端表现
- [x] 7.3 更新文档/帮助，说明分类、批量操作和导出能力
