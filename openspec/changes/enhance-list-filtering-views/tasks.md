# Tasks: Enhance list filtering and view modes

## 1. Data Model & Database
- [x] 1.1 评估是否需要扩展 `content_type` 枚举（添加 webpage、snippet、note、image、file）
- [x] 1.2 创建数据库迁移文件，扩展 `content_type` 枚举（如果需要）
- [x] 1.3 添加数据库索引：`idx_notes_user_title`、`idx_notes_user_site_name`（用于按标题/网站排序）
- [x] 1.4 确认 `archived_at`、`updated_at` 字段已存在并可用于筛选/排序

## 2. Backend API Enhancement
- [x] 2.1 扩展 notes 查询 API，支持 `show_archived` 参数（boolean，默认 false）
- [x] 2.2 扩展 notes 查询 API，支持 `content_type` 过滤参数（可选，枚举值）
- [x] 2.3 扩展 notes 查询 API，支持 `sort_by` 和 `sort_order` 参数（created_at/updated_at/title/site_name, asc/desc）
- [x] 2.4 测试 API 参数组合（筛选+排序+分页），确保查询性能和正确性

## 3. Frontend State Management
- [x] 3.1 在 dashboard-content.tsx 中添加筛选/排序/视图状态（showArchived、contentTypeFilter、sortBy、sortOrder、viewMode）
- [x] 3.2 实现 viewMode 持久化到 localStorage，页面刷新后恢复用户偏好
- [x] 3.3 状态变化时触发 `fetchNotes()` 重新查询，并重置分页游标
- [x] 3.4 确保筛选/排序状态与侧边栏分类导航（收藏夹/标签/智能列表）联动正确

## 4. Toolbar UI Components
- [x] 4.1 实现"已归档"Toggle 按钮，点击切换 `showArchived` 状态，激活时高亮显示
- [x] 4.2 实现"筛选"DropdownMenu，包含内容类型选项（不限、文章、视频、语音），选中项显示勾选标记
- [x] 4.3 实现"排序"DropdownMenu，包含 8 种排序选项，默认显示当前选中项，选中项显示勾选标记
- [x] 4.4 实现"视图"DropdownMenu，包含 5 种视图模式（详情卡片、紧凑卡片、详情列表、紧凑列表、标题列表），选中项显示勾选标记
- [x] 4.5 调整工具栏布局，确保在搜索框右侧合理排列，移动端响应式适配

## 5. View Mode Rendering
- [x] 5.1 实现"详情卡片"视图（当前样式，Grid 3列，包含封面+标题+摘要+标签+元数据）
- [x] 5.2 实现"紧凑卡片"视图（Grid 4列，小封面+标题单行+元数据单行，固定高度）
- [x] 5.3 实现"详情列表"视图（单列，左封面+中间标题摘要标签+右元数据操作）
- [x] 5.4 实现"紧凑列表"视图（单列，左mini封面+中间标题单行+右元数据单行，固定高度）
- [x] 5.5 实现"标题列表"视图（单列，仅复选框+标题+日期，固定高度）
- [x] 5.6 抽象共享组件（NoteCardBase、NoteListItemBase）减少代码重复
- [x] 5.7 确保所有视图模式支持 hover 效果、复选框、星标、操作菜单等交互

## 6. "添加"按钮重构
- [x] 6.1 将"添加"按钮改为圆形图标按钮（Plus 图标，`h-10 w-10 rounded-full`）
- [x] 6.2 实现"添加"按钮 DropdownMenu，包含"添加网址"、"添加速记"、"上传图片/视频/文件"三个选项
- [x] 6.3 将原有的"添加笔记"Dialog 逻辑整合到 DropdownMenu 选项对应的 handlers（handleAddUrl、handleAddNote、handleUpload）
- [x] 6.4 确保"添加"按钮在工具栏中位置合理（最右侧），与其他按钮样式一致

## 7. Integration & Testing
- [x] 7.1 测试"已归档"切换功能，确保正确显示/隐藏已归档内容
- [x] 7.2 测试"筛选"功能，验证各内容类型过滤是否正确
- [x] 7.3 测试"排序"功能，验证 8 种排序模式是否正确生效
- [x] 7.4 测试"视图"切换功能，验证 5 种视图模式渲染正确且交互完整
- [x] 7.5 测试"添加"按钮下拉菜单，验证三种添加方式（网址/速记/上传）功能正常
- [x] 7.6 测试筛选/排序/视图状态持久化（刷新页面后保持）
- [x] 7.7 测试移动端响应式布局，确保工具栏和视图模式在小屏幕上可用

## 8. Documentation
- [x] 8.1 更新用户文档，说明新增的筛选、排序、视图功能
- [x] 8.2 更新开发文档，说明 content_type 枚举扩展和 API 参数变化

