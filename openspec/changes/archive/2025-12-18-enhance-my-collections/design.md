## Context
- "我的收藏"目前只有基础列表。用户需要一套类似 Cubox 的多分类导航、智能聚类、批量操作与导出体验，且内容来源包含网址抓取、手动速记、以及上传的图片/视频/文件。
- 现有数据库（notes/folders/tags）仅支持基础字段，没有星标标记、智能列表或上传文件存储约定，前端也未支持无限滚动与批量操作。

## Goals
- 统一“我的收藏”分类导航：未分类、所有、星标、今日、智能列表、收藏夹。
- 支持大规模列表的滑动分页，并在分类/搜索切换时保持性能。
- 提供覆盖单个笔记和批量的操作（复制、导出、星标、移动、标签、归档、删除）。
- 在同一入口新增三种创建方式：添加网址、速记文本、上传媒体文件。
- 解决微信公众号图片等引用的防盗链需求（配合 `referrerpolicy` 和/或代理）。

## Non-Goals
- 不实现 AI 聚类算法之外的推荐系统或多用户协作。
- 不在此变更中定义阅读视图/注释等后续阶段能力。

## Decisions
1. **分类与计数**：
   - notes 表新增 `is_starred boolean default false`、`captured_at timestamptz`（若尚未存在）以支持星标与今日筛选（基于 created_at/captured_at 当日）。
   - “未分类”通过 `folder_id IS NULL` 判定；“收藏夹”使用 folders 关联；“智能列表”初期按标签共现与来源域名组合生成（由服务端返回 list definition + note_ids）。
2. **分页策略**：
   - Notes API 改为 cursor-based（`created_at DESC, id DESC`）分页，前端使用无限滚动（IntersectionObserver）触发 `loadMore`。
   - 切换分类/搜索条件时重置 cursor，防止旧数据混入。
3. **操作与导出**：
   - 前端提供操作面板；后端暴露 `/api/notes/[id]/export?format=txt|md|html` 等端点，并支持批量（POST body note_ids + format）。
   - 复制内容通过后端返回三种格式字符串，前端写入剪贴板 API。
   - 批量操作通过 `/api/notes/batch` 接口完成，返回成功/失败清单。
4. **创建入口**：
   - “添加网址”复用现有 capture API。
   - “速记”创建 note 时 `content_type="article"` 并直接存储用户输入文本/HTML；跳过抓取流程。
   - “上传”先将文件上传到 Supabase Storage（bucket: `user-files`），再创建 note：
     - 图片 -> `content_type="article"` + `cover_image_url` 指向 storage；
     - 视频/音频 -> 生成 `media_url`, `media_duration`（若能解析），`content_type`=video/audio；
     - 其他文件 -> 标记为附件型 note，保存 metadata。
5. **安全与合规**：
   - 上传限制大小/类型，并使用 signed URL 控制访问。
   - 复制/导出在服务器侧统一 sanitized 内容，避免注入。

## Risks / Trade-offs
- 智能列表算法的准确性：先采用简单规则（标签+来源）并在后续迭代。
- 批量导出可能导致大文件/长耗时：需加入进度反馈与节流。
- 上传文件的存储成本：通过 Supabase Storage 生命周期策略控制。

## Migration Plan
1. 数据库添加 `is_starred`、`captured_at`（若缺失）、`source_type`（url/manual/upload）等字段以及必要索引。
2. 部署新的 notes 列表 API（支持 filters/cursor）。
3. 发布前端：新侧边栏、列表、操作面板、创建入口。
4. 提供后台脚本把既有数据填充 `captured_at` 与 `source_type`。

## Open Questions
- 智能列表是否需要用户自定义规则？（当前假设不需要）
- 上传文件的最大尺寸与支持的具体格式？需要产品确认。
- 批量导出是否需打包 zip？（暂按多个文件/单个 zip 设计可配置）。
