## MODIFIED Requirements

### Requirement: Library listing and retrieval
The system SHALL provide a library view that lists a user's notes/items with advanced filtering, sorting, and multiple view modes.

#### Scenario: Filter by archived status
- **WHEN** the user toggles the "已归档" button in the toolbar
- **THEN** the system displays archived items if enabled, or hides them if disabled (default)

#### Scenario: Filter by content type
- **WHEN** the user selects a content type from the "筛选" dropdown (不限、文章、网页、片段、速记、图片、语音、视频、文件)
- **THEN** the system displays only notes/items matching the selected content type, or all types if "不限" is selected

#### Scenario: Sort notes by multiple criteria
- **WHEN** the user selects a sort option from the "排序" dropdown
- **THEN** the system reorders the list according to the selected criteria:
  - 按创建时间 从新到旧 (default)
  - 按创建时间 从旧到新
  - 按更新时间 从新到旧
  - 按更新时间 从旧到新
  - 按标题 A-Z
  - 按标题 Z-A
  - 按网站 A-Z
  - 按网站 Z-A

#### Scenario: Switch view modes
- **WHEN** the user selects a view mode from the "视图" dropdown
- **THEN** the system renders the list in the selected mode and persists the preference:
  - 详情卡片: Grid layout, large cover image, title, excerpt, tags, metadata
  - 紧凑卡片: Grid layout, small cover image, title (single line), metadata (single line)
  - 详情列表: Single-column list, medium cover image, title + excerpt + tags, metadata + actions
  - 紧凑列表: Single-column list, mini cover image, title (single line), metadata (single line)
  - 标题列表: Single-column list, checkbox + title + date only, no cover image

## ADDED Requirements

### Requirement: Toolbar filtering and sorting controls
The system SHALL provide a toolbar with buttons for archived status toggle, content type filter, sort options, and view mode selection, positioned after the search box.

#### Scenario: Access filtering controls
- **WHEN** the user views the library/dashboard toolbar
- **THEN** the system displays buttons for "已归档" (toggle), "筛选" (dropdown), "排序" (dropdown), "视图" (dropdown), arranged horizontally after the search box

#### Scenario: Toggle archived status
- **WHEN** the user clicks the "已归档" toggle button
- **THEN** the system highlights the button (if enabled) and refreshes the list to include or exclude archived items

#### Scenario: Persist view mode preference
- **WHEN** the user selects a view mode
- **THEN** the system saves the preference to localStorage and restores it on subsequent page loads

### Requirement: Streamlined add button
The system SHALL provide a circular icon-only "添加" button that opens a dropdown menu with options to add URL, quick note, or upload files.

#### Scenario: Open add menu
- **WHEN** the user clicks the circular "+" button in the toolbar
- **THEN** the system displays a dropdown menu with three options: "添加网址", "添加速记", "上传图片/视频/文件"

#### Scenario: Add via dropdown menu
- **WHEN** the user selects an option from the add menu
- **THEN** the system opens the corresponding dialog or flow (URL input, quick note editor, file upload picker)

