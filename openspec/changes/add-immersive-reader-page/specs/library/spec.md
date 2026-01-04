# library Spec Delta

## ADDED Requirements

### Requirement: 沉浸式阅读页入口
系统SHALL在笔记列表中提供跳转到沉浸式阅读详情页的入口。

#### Scenario: 点击笔记卡片打开沉浸式阅读页
- **WHEN** 用户在库(library)或仪表盘(dashboard)中点击笔记卡片
- **THEN** 系统导航到 `/notes/[id]/read` 路由，打开沉浸式阅读详情页

#### Scenario: 提供快速预览选项
- **WHEN** 用户在笔记卡片上右键或长按
- **THEN** 系统显示上下文菜单，包含"快速预览"和"打开阅读页"选项

### Requirement: 阅读进度可视化
系统SHALL在笔记列表卡片上显示阅读进度，帮助用户识别未读/在读/已读状态。

#### Scenario: 显示未读标记
- **WHEN** 笔记的read_percentage为0或NULL
- **THEN** 系统在笔记卡片上显示"未读"徽章或点标记

#### Scenario: 显示阅读进度条
- **WHEN** 笔记的read_percentage在0-100之间
- **THEN** 系统在笔记卡片底部显示进度条，直观展示阅读进度百分比

#### Scenario: 显示已读标记
- **WHEN** 笔记的read_percentage达到90%或以上
- **THEN** 系统在笔记卡片上显示"已读"标记或勾选图标

### Requirement: 快速批注入口
系统SHALL在笔记列表中显示批注数量，提供快速访问批注的入口。

#### Scenario: 显示批注数量徽章
- **WHEN** 笔记存在批注(annotations + highlights)
- **THEN** 系统在笔记卡片上显示批注数量徽章（如"3条批注"）

#### Scenario: 点击批注徽章跳转到批注面板
- **WHEN** 用户点击笔记卡片上的批注徽章
- **THEN** 系统打开沉浸式阅读页，并自动展开右侧批注面板

## MODIFIED Requirements

### Requirement: Library listing and retrieval
系统SHALL提供库视图，列出用户的笔记/条目，允许打开单个笔记进行阅读，并显示阅读进度和批注信息。

#### Scenario: List notes in the library
- **WHEN** 用户打开库
- **THEN** 系统显示笔记列表，按定义的默认顺序排序（如最近优先），每个笔记卡片显示标题、封面图、摘要、阅读进度、批注数量

#### Scenario: Open a note in immersive reader
- **WHEN** 用户从列表中选择一个笔记/条目
- **THEN** 系统导航到 `/notes/[id]/read`，打开沉浸式阅读详情页，显示完整内容和交互功能

#### Scenario: Continue reading from last position
- **WHEN** 用户打开之前阅读过的笔记
- **THEN** 系统自动跳转到上次阅读位置（图文滚动位置或视频播放进度）

