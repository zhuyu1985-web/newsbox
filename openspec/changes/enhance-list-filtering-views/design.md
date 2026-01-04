# Design: Enhance list filtering and view modes

## Context
- "我的收藏"当前只支持按收藏夹/标签/分类导航，缺少内容类型筛选、排序控制和多视图模式。
- 用户在浏览大量内容时需要根据场景切换展示密度（详情 vs 紧凑，卡片 vs 列表）。
- 顶部工具栏空间有限，需要合理组织筛选、排序、视图、归档等功能。

## Goals
- 提供完整的筛选能力：已归档状态切换、按内容类型过滤。
- 提供灵活的排序选项：按创建/更新时间、标题、网站，正序/倒序。
- 提供 5 种视图模式：详情卡片、紧凑卡片、详情列表、紧凑列表、标题列表。
- 优化"添加"按钮为圆形图标，整合添加网址/速记/上传功能到下拉菜单。

## Non-Goals
- 不实现高级搜索（如全文搜索、正则表达式），保留为后续增强。
- 不实现自定义视图配置（如用户自定义卡片字段），当前固定 5 种预设视图。
- 不实现拖拽排序或手动调整列表顺序。

## Decisions

### 1. 工具栏布局
- 顶部工具栏位于搜索框右侧，包含：
  - **已归档按钮**：Toggle 按钮，点击切换是否显示已归档内容，激活时高亮显示。
  - **筛选按钮**：DropdownMenu，包含内容类型选项（不限、文章、网页、片段、速记、图片、语音、视频、文件），单选模式，选中项显示勾选标记。
  - **排序按钮**：DropdownMenu，包含 8 种排序选项，默认"按创建时间 从新到旧"，选中项显示勾选标记。
  - **视图按钮**：DropdownMenu，包含 5 种视图模式，默认"详情卡片"，选中项显示勾选标记。
  - **添加按钮**：圆形图标按钮（Plus 图标），点击显示 DropdownMenu，包含"添加网址"、"添加速记"、"上传图片/视频/文件"三个选项。

### 2. 数据模型扩展
- **content_type 枚举扩展**：当前 `content_type` 为 `article|video|audio`，需扩展为：
  - `article`：文章（传统网页文章）
  - `webpage`：网页（一般网页）
  - `snippet`：片段（用户选择的网页片段）
  - `note`：速记（用户手动输入的文本）
  - `image`：图片
  - `audio`：语音/音频
  - `video`：视频
  - `file`：文件（其他类型文件）
- **archived_at 字段**：已有 `notes` 表中的 `archived_at` 字段，用于标记归档状态。
- **updated_at 字段**：已有 `notes` 表中的 `updated_at` 字段，用于按更新时间排序。

### 3. API 查询参数
- **GET /api/notes** 或 Supabase 查询扩展参数：
  - `show_archived`: boolean（默认 false），是否包含已归档项。
  - `content_type`: string（可选），内容类型过滤，值为上述枚举之一。
  - `sort_by`: string（默认 `created_at`），排序字段：`created_at`、`updated_at`、`title`、`site_name`。
  - `sort_order`: string（默认 `desc`），排序方向：`asc`、`desc`。
- 示例查询：
  ```
  supabase
    .from("notes")
    .select("...")
    .eq("user_id", userId)
    .is("archived_at", showArchived ? undefined : null)
    .eq("content_type", contentTypeFilter || undefined)
    .order(sortBy, { ascending: sortOrder === "asc" })
  ```

### 4. 视图模式实现
- **视图模式枚举**：`detail-card` | `compact-card` | `detail-list` | `compact-list` | `title-list`
- **视图模式样式**：
  - **detail-card**（详情卡片，当前样式）：
    - Grid 布局，3 列（桌面）/ 2 列（平板）/ 1 列（移动）
    - 包含封面图（1.6:1）、标题、摘要、标签、元数据（网站、日期）
    - 卡片高度自适应内容
  - **compact-card**（紧凑卡片）：
    - Grid 布局，4 列（桌面）/ 3 列（平板）/ 2 列（移动）
    - 包含小封面图（4:3）、标题（单行）、元数据（网站、日期，单行）
    - 卡片固定高度，无摘要、无标签
  - **detail-list**（详情列表）：
    - 单列列表布局
    - 每行包含：左侧小封面图（100x100）、中间标题+摘要+标签、右侧元数据（网站、日期、操作按钮）
    - 行高自适应内容
  - **compact-list**（紧凑列表）：
    - 单列列表布局
    - 每行包含：左侧 mini 封面图（60x60）、中间标题（单行）、右侧元数据（网站、日期，单行）
    - 行固定高度，无摘要、无标签
  - **title-list**（标题列表）：
    - 单列列表布局
    - 每行仅包含：复选框、标题（单行）、日期
    - 行固定高度，无封面图、无摘要、无标签

### 5. 前端状态管理
- 使用 React state 管理当前筛选/排序/视图状态：
  ```typescript
  const [showArchived, setShowArchived] = useState(false);
  const [contentTypeFilter, setContentTypeFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"created_at" | "updated_at" | "title" | "site_name">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"detail-card" | "compact-card" | "detail-list" | "compact-list" | "title-list">("detail-card");
  ```
- 状态变化时重新触发 `loadData()` 查询。
- 视图模式持久化到 localStorage，页面刷新后保持用户偏好。

### 6. "添加"按钮重构
- 当前"添加"按钮为 `<Button>添加</Button>` + Dialog。
- 重构为：
  ```tsx
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button size="icon" className="h-10 w-10 rounded-full">
        <Plus className="h-5 w-5" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={handleAddUrl}>
        <Link className="h-4 w-4 mr-2" /> 添加网址
      </DropdownMenuItem>
      <DropdownMenuItem onClick={handleAddNote}>
        <FileText className="h-4 w-4 mr-2" /> 添加速记
      </DropdownMenuItem>
      <DropdownMenuItem onClick={handleUpload}>
        <Upload className="h-4 w-4 mr-2" /> 上传图片/视频/文件
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
  ```

## Risks / Trade-offs
- **content_type 枚举扩展**：需要数据库迁移，既有数据可能需要重新分类（如 `article` 可能需要拆分为 `article` vs `webpage`）。
- **多视图模式维护成本**：5 种视图需要维护 5 套渲染逻辑，建议抽象共享组件（如 `NoteCardBase`、`NoteListItemBase`）以减少代码重复。
- **排序性能**：按 `title`、`site_name` 排序可能需要额外索引，建议添加 `idx_notes_user_title`、`idx_notes_user_site_name` 复合索引。

## Migration Plan
1. **数据库迁移**（如果需要扩展 content_type）：
   - 修改 `content_type` 枚举类型，添加 `webpage`、`snippet`、`note`、`image`、`file`。
   - 添加索引：`CREATE INDEX idx_notes_user_title ON notes(user_id, title);` 和 `CREATE INDEX idx_notes_user_site_name ON notes(user_id, site_name);`。
2. **后端 API 更新**：
   - 修改 notes 查询逻辑，支持 `show_archived`、`content_type`、`sort_by`、`sort_order` 参数。
3. **前端 UI 更新**：
   - 实现顶部工具栏（已归档、筛选、排序、视图按钮）。
   - 实现 5 种视图模式的渲染组件。
   - 重构"添加"按钮为圆形图标 + 下拉菜单。
   - 更新状态管理和数据加载逻辑。
4. **测试与验证**：
   - 测试筛选、排序、视图切换功能。
   - 测试已归档内容的显示/隐藏。
   - 测试"添加"按钮下拉菜单的交互。

## Open Questions
- **content_type 分类规则**：如何自动区分 `article` vs `webpage`？建议基于内容长度或 HTML 结构判断（如有 `<article>` 标签则为 `article`，否则为 `webpage`）。
- **视图模式默认值**：是否需要根据设备类型（桌面/移动）自动选择默认视图？建议桌面默认"详情卡片"，移动默认"紧凑列表"。
- **已归档内容的访问路径**：是否需要单独的"归档"入口（如侧边栏"归档"分类）？当前设计为通过顶部"已归档"按钮切换，可后续扩展专门入口。

