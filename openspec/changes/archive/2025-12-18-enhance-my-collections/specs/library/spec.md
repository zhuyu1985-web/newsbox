## ADDED Requirements
### Requirement: My collections navigation categories
The system SHALL render "我的收藏" with fixed navigation entries (未分类、所有、星标、今日、收藏夹) and keep counts/filters in sync with note data.

#### Scenario: Default to 未分类
- **WHEN** the user打开我的收藏首次访问或刷新
- **THEN** the view defaults to "未分类"并仅展示 `folder_id IS NULL` 的笔记

#### Scenario: View all items
- **WHEN** the user点击“所有”
- **THEN** the system显示用户拥有的全部笔记（含网址抓取、速记、上传）并重置其他过滤

#### Scenario: View starred items
- **WHEN** the user点击“星标”
- **THEN**仅展示 `is_starred=true` 的笔记，并支持取消星标后立即从视图移除

#### Scenario: View today items
- **WHEN** the user点击“今日”
- **THEN**仅显示创建时间或采集时间为当天（按用户时区计算）的笔记

#### Scenario: View folder contents
- **WHEN** the user从“收藏夹”列表选择某个自定义文件夹
- **THEN**页面仅显示属于该文件夹的笔记，并在导航中高亮对应文件夹

### Requirement: Smart list clustering
The system SHALL provide a "智能列表"区域，根据标签/来源等特征自动聚类并可切换查看。

#### Scenario: Display auto clusters
- **WHEN**用户展开智能列表
- **THEN**系统至少显示一组按标签或来源域名聚类的列表项（例如“AI 资讯”“微信公众号”），并标注命中数量

#### Scenario: Filter by smart list
- **WHEN**用户点击某个智能列表项
- **THEN**只展示属于该聚类的笔记，且可通过“清除”恢复原视图

### Requirement: Infinite scroll pagination
The system SHALL support滑动分页/无限滚动以加载大量笔记。

#### Scenario: Scroll to load more
- **WHEN**用户滚动至列表底部且仍有更多笔记
- **THEN**系统自动或通过“加载更多”按钮获取下一页（基于 cursor）并追加到当前列表

#### Scenario: Reset pagination on filter change
- **WHEN**用户切换分类、智能列表、标签或搜索关键词
- **THEN**系统清空已显示的列表并从第一页重新加载对应数据，避免旧数据混入

### Requirement: Note actions & exports
The system SHALL expose per-note actions：打开原文、复制原文链接、复制内容（纯文本/Markdown/HTML）以及导出（txt/Markdown/HTML 文件）。

#### Scenario: Open original and copy link
- **WHEN**用户点击“打开原文”或“复制链接”
- **THEN**系统分别在新标签打开 source_url、或将 source_url 写入剪贴板

#### Scenario: Copy content in multiple formats
- **WHEN**用户选择复制纯文本/Markdown/HTML 任一选项
- **THEN**系统从已抓取/用户输入内容生成对应格式并复制到剪贴板

#### Scenario: Export note to local files
- **WHEN**用户选择导出 txt/Markdown/HTML
- **THEN**系统生成对应文件（含标题、元信息、内容）并触发浏览器下载

### Requirement: Organizational state changes
The system SHALL allow星标、移动到收藏夹、设置/移除标签、归档、删除等操作并即时更新 UI。

#### Scenario: Toggle starred state
- **WHEN**用户点击星标按钮
- **THEN**系统切换 `is_starred` 状态并在当前视图中实时反映（若从星标列表取消则移出）

#### Scenario: Move to folder / manage tags
- **WHEN**用户选择“移动到收藏夹”或“设置标签”
- **THEN**系统展示现有收藏夹/标签选择器，提交后在数据库中更新关联，并刷新列表

#### Scenario: Archive or delete
- **WHEN**用户执行归档或删除
- **THEN**系统更新读状态/软删除记录，并从当前视图移除该笔记

### Requirement: Bulk actions across notes
The system SHALL提供多选与批量操作入口，支持星标、移动、标签、归档、删除、复制、导出。

#### Scenario: Select multiple notes
- **WHEN**用户进入多选模式并勾选多个笔记
- **THEN**系统在顶部或底部显示批量操作工具条并展示已选数量

#### Scenario: Execute bulk operation
- **WHEN**用户在批量模式下选择某个动作（例如批量导出 Markdown）
- **THEN**系统对所有选中笔记执行该操作，并在全部成功或部分失败时给出反馈清单

### Requirement: Multi-source note creation entry
The system SHALL在“添加笔记”里提供“添加网址”“速记”“上传”三种入口，并串联到相应 capture 能力。

#### Scenario: Add URL
- **WHEN**用户在“添加网址”tab 输入合法链接
- **THEN**系统调用 URL capture 流程并将结果展示在列表中

#### Scenario: Add quick note
- **WHEN**用户在“速记”tab 输入文本（可含富文本/Markdown）
- **THEN**系统直接保存为笔记并跳过抓取流程，仍可在列表中被筛选/移动

#### Scenario: Upload media/file
- **WHEN**用户在“上传”tab 选择图片/视频/文件并提交
- **THEN**系统将文件上传至受控存储、创建关联笔记，并在我的收藏中显示缩略图/文件信息
