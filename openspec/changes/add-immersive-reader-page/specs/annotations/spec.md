# annotations Spec Delta

## ADDED Requirements

### Requirement: 多色高亮标记
系统SHALL支持创建多种颜色的高亮标记，帮助用户区分不同类型的重点内容。

#### Scenario: 选择高亮颜色
- **WHEN** 用户在划词气泡菜单中点击高亮按钮
- **THEN** 系统显示颜色选择器（黄色、绿色、蓝色、粉色、紫色），用户选择后创建对应颜色的高亮

#### Scenario: 修改已有高亮的颜色
- **WHEN** 用户在批注卡片中点击改色按钮
- **THEN** 系统显示颜色选择器，选择新颜色后更新高亮，文章中的高亮背景色立即变化

#### Scenario: 不同颜色高亮在文章中区分显示
- **WHEN** 文章包含多个不同颜色的高亮
- **THEN** 系统使用不同背景色渲染各个高亮，用户可清晰区分

### Requirement: 视频批注功能
系统SHALL支持为视频内容创建批注，包括截帧图片、时间戳、台词引用。

#### Scenario: 视频播放时创建批注
- **WHEN** 用户在视频播放时点击截帧按钮或批注按钮
- **THEN** 系统暂停视频，截取当前画面，创建批注记录，包含截图URL、时间戳、当前台词（如有逐字稿）

#### Scenario: 视频批注卡片显示截帧
- **WHEN** 用户查看视频批注列表
- **THEN** 系统在批注卡片中显示截帧缩略图、时间戳（如"05:32"）、用户笔记、台词引用

#### Scenario: 点击视频批注跳转到对应时刻
- **WHEN** 用户在批注列表中点击某个视频批注卡片
- **THEN** 系统视频seek到批注的时间戳，开始播放

#### Scenario: 视频批注支持导出
- **WHEN** 用户导出视频笔记
- **THEN** 系统将所有批注的截帧图片、时间戳、笔记打包导出

### Requirement: 浮顶批注卡片
系统SHALL支持将批注卡片"浮顶"，变为全局悬浮窗，方便跨文章对比和引用。

#### Scenario: 点击图钉浮顶批注
- **WHEN** 用户在批注卡片中点击图钉按钮
- **THEN** 系统将该卡片从侧栏列表中脱离，变为Portal渲染的全局悬浮窗，显示在页面最上层

#### Scenario: 浮顶卡片可拖拽移动
- **WHEN** 浮顶卡片显示状态
- **THEN** 系统允许用户拖拽卡片标题栏，移动到任意位置，位置保存到会话状态

#### Scenario: 浮顶卡片跨页面保持显示
- **WHEN** 用户浮顶一个批注卡片后导航到另一篇笔记
- **THEN** 浮顶卡片仍然显示在新页面上，方便对比引用

#### Scenario: 点击浮顶卡片跳回原文
- **WHEN** 用户在浮顶卡片中点击引用文字或跳转按钮
- **THEN** 系统导航回原笔记，滚动到批注位置

#### Scenario: 取消浮顶恢复到侧栏
- **WHEN** 用户在浮顶卡片中点击取消图钉按钮
- **THEN** 系统将卡片恢复到右侧批注列表中，浮顶状态解除

#### Scenario: 同时浮顶多个批注
- **WHEN** 用户浮顶多个批注卡片
- **THEN** 系统以堆叠或瀑布流方式显示多个浮顶卡片，避免重叠

### Requirement: 批注位置智能恢复
系统SHALL在内容结构变化时尽可能恢复高亮和批注的正确位置。

#### Scenario: HTML结构不变时精确恢复
- **WHEN** 内容HTML结构未变化且range_data有效
- **THEN** 系统使用range_data（DOM路径+偏移量）精确定位高亮位置

#### Scenario: 结构变化时使用quote匹配
- **WHEN** range_data失效（DOM结构变化）
- **THEN** 系统使用quote字段（存储的引用文字）进行模糊匹配，尝试定位到最相似的文本位置

#### Scenario: 匹配失败时显示孤立批注
- **WHEN** quote匹配也无法找到对应文本
- **THEN** 系统在批注卡片上显示"原文已变更"警告，批注保留但无法定位

#### Scenario: 用户手动重新定位批注
- **WHEN** 批注位置失效
- **THEN** 系统提供"重新定位"按钮，用户可手动选中新的文本范围，更新批注位置

### Requirement: 批注导出功能
系统SHALL支持将批注导出为多种格式，方便用户整理和分享。

#### Scenario: 导出批注为Markdown
- **WHEN** 用户点击"导出批注"→"Markdown格式"
- **THEN** 系统生成Markdown文件，包含所有批注的引用、笔记、时间戳，按位置排序

#### Scenario: 导出批注为CSV
- **WHEN** 用户点击"导出批注"→"CSV格式"
- **THEN** 系统生成CSV文件，每行一条批注，包含列：引用文字、笔记内容、颜色、位置、创建时间

#### Scenario: 导出包含截图的批注
- **WHEN** 用户导出视频批注
- **THEN** 系统将截帧图片一并打包下载，Markdown中使用图片链接引用

## MODIFIED Requirements

### Requirement: Highlight text in note content
系统SHALL允许用户在渲染的笔记内容中高亮选中的文本范围，支持多种颜色和视频时间戳。

#### Scenario: Create highlight from selection with color
- **WHEN** 用户在笔记内容中选中文字，选择高亮并指定颜色
- **THEN** 系统创建高亮记录，存储quote、range_data、color字段，在文章中以对应颜色渲染高亮

#### Scenario: Create video highlight with timecode
- **WHEN** 用户在视频内容中创建高亮或批注
- **THEN** 系统创建高亮记录，存储当前视频时间戳(timecode)和截帧图片URL(screenshot_url)

#### Scenario: Highlight persists across sessions with color
- **WHEN** 高亮创建完成
- **THEN** 系统存储高亮并在用户下次查看笔记时以正确颜色显示

### Requirement: View and manage highlights and annotations
系统SHALL在右侧面板中显示所有高亮和批注，支持编辑、删除、改色、浮顶等管理操作。

#### Scenario: List highlights with color indicators
- **WHEN** 用户查看笔记的批注列表
- **THEN** 系统显示所有高亮和批注，高亮用彩色边框或背景标识颜色

#### Scenario: Edit annotation content
- **WHEN** 用户点击编辑按钮修改批注内容
- **THEN** 系统显示编辑框，保存后更新批注内容和updated_at时间戳

#### Scenario: Change highlight color
- **WHEN** 用户点击改色按钮选择新颜色
- **THEN** 系统更新高亮颜色，文章中的高亮背景色立即变化

#### Scenario: Pin annotation to float globally
- **WHEN** 用户点击图钉按钮
- **THEN** 系统将批注卡片变为全局悬浮窗，跨页面保持显示

#### Scenario: Delete highlight or annotation with confirmation
- **WHEN** 用户点击删除按钮
- **THEN** 系统弹出确认对话框，确认后删除批注记录，文章中的高亮移除

