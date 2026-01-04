# reader-page Spec Delta

## ADDED Requirements

### Requirement: 三栏响应式阅读布局
系统SHALL提供三栏式响应式布局（左侧导航、中间内容舞台、右侧智库面板），右侧面板支持分屏或标签页切换，支持禅模式全屏阅读。

#### Scenario: 打开阅读页显示三栏布局
- **WHEN** 用户访问 `/notes/[id]/read` 路由
- **THEN** 系统显示三栏布局，左侧显示大纲或章节，中间显示内容，右侧显示批注和AI面板

#### Scenario: 启用禅模式隐藏侧栏
- **WHEN** 用户点击禅模式按钮或按下快捷键
- **THEN** 系统隐藏左右侧栏，内容区域全屏显示，再次点击恢复

#### Scenario: 移动端自适应单栏布局
- **WHEN** 在小于768px的设备上访问阅读页
- **THEN** 系统显示单栏布局，侧栏改为全屏抽屉，通过Tab或按钮切换

#### Scenario: 右侧面板标签页切换
- **WHEN** 用户在右侧面板点击不同的Tab（批注列表、AI解读、视频听记）
- **THEN** 系统切换显示对应的面板内容，保持单一焦点

#### Scenario: 右侧面板分屏模式（可选）
- **WHEN** 用户启用分屏模式
- **THEN** 系统同时显示批注列表和AI解读，上下分屏或自定义比例

### Requirement: 多态内容路由
系统SHALL根据笔记的content_type字段自动选择合适的渲染模式（图文模式或视频模式）。

#### Scenario: 图文类型渲染ArticleReader
- **WHEN** 笔记的content_type为'article'
- **THEN** 系统在中间舞台渲染ArticleReader组件，左侧显示智能大纲

#### Scenario: 视频类型渲染VideoPlayer
- **WHEN** 笔记的content_type为'video'
- **THEN** 系统在中间舞台渲染VideoPlayer组件，左侧显示智能章节，右侧增加逐字稿Tab

#### Scenario: 音频类型渲染AudioPlayer
- **WHEN** 笔记的content_type为'audio'
- **THEN** 系统渲染AudioPlayer组件，右侧显示逐字稿

### Requirement: 视图切换器
系统SHALL提供4种视图模式切换：沉浸阅读、原始网页、AI速览、网页存档。

#### Scenario: 默认显示沉浸阅读视图
- **WHEN** 用户首次打开阅读页
- **THEN** 系统默认显示沉浸阅读视图（Article Reader或Video Player）

#### Scenario: 切换到原始网页视图
- **WHEN** 用户点击"原始网页"Tab
- **THEN** 系统在iframe中加载原始URL，保留原站排版

#### Scenario: 切换到AI速览视图
- **WHEN** 用户点击"AI速览"Tab
- **THEN** 系统显示AI生成的结构化事实卡片（核心事实、人物、结果）

#### Scenario: 切换到网页存档视图
- **WHEN** 用户点击"网页存档"Tab且存档已创建
- **THEN** 系统显示保存的HTML快照

#### Scenario: 网页存档未创建时提示
- **WHEN** 用户点击"网页存档"Tab但存档未创建
- **THEN** 系统显示"尚未创建存档"提示和"创建存档"按钮

### Requirement: 图文阅读模式纯净渲染
系统SHALL提供纯净的图文阅读体验，去除广告和无关元素，保留高质量排版。

#### Scenario: 使用Jina Reader提取高质量正文
- **WHEN** 渲染图文内容
- **THEN** 系统优先使用Jina Reader API提取的纯净正文，失败时降级到原始content_html

#### Scenario: 渲染保留代码高亮和图片
- **WHEN** 文章包含代码块或图片
- **THEN** 系统使用shiki进行代码高亮，图片添加referrerPolicy防盗链

#### Scenario: 保留图片说明文字
- **WHEN** 文章图片下方有说明文字（图注）
- **THEN** 系统在提取内容时保留图注，图片和说明文字一起渲染显示

#### Scenario: 显示元信息头
- **WHEN** 渲染图文内容
- **THEN** 系统在顶部显示标题、来源媒体（Icon+名称）、作者、发布时间、抓取时间、标签、预估阅读时间

### Requirement: 划词气泡菜单
系统SHALL支持用户选中文字后弹出气泡菜单，提供高亮、批注、AI解释、搜索、复制等快捷操作。

#### Scenario: 选中文字显示气泡菜单
- **WHEN** 用户在文章内容中选中文字
- **THEN** 系统在选区附近显示浮动气泡菜单，包含[高亮][批注][AI解释][搜索][复制]按钮

#### Scenario: 点击高亮创建高亮标记
- **WHEN** 用户在气泡菜单点击[高亮]按钮
- **THEN** 系统创建高亮记录，选中文字显示高亮背景色，气泡菜单关闭

#### Scenario: 点击批注打开批注输入框
- **WHEN** 用户在气泡菜单点击[批注]按钮
- **THEN** 系统打开批注输入框，可选是否同时创建高亮，输入完成后保存批注

#### Scenario: 点击AI解释调用AI分析
- **WHEN** 用户在气泡菜单点击[AI解释]按钮
- **THEN** 系统调用AI API解释选中文字，在气泡中或侧栏显示解释结果

#### Scenario: 点击复制提供多种格式
- **WHEN** 用户在气泡菜单点击[复制]按钮
- **THEN** 系统显示子菜单：复制纯文本、复制Markdown、复制为引用格式

### Requirement: 智能大纲导航
系统SHALL为图文内容自动生成或提取大纲，提供快速导航能力。

#### Scenario: 提取H1-H3标题作为大纲
- **WHEN** 文章HTML包含H1、H2、H3标题标签
- **THEN** 系统提取这些标题构建分层大纲，显示在左侧边栏

#### Scenario: 无标题时AI生成大纲
- **WHEN** 文章HTML不包含标题标签
- **THEN** 系统调用AI基于内容生成关键段落标题作为锚点

#### Scenario: 点击大纲项跳转到对应位置
- **WHEN** 用户点击左侧大纲中的某个标题
- **THEN** 系统平滑滚动到文章对应位置，该标题在大纲中高亮

#### Scenario: 滚动时高亮当前章节
- **WHEN** 用户滚动文章内容
- **THEN** 系统根据滚动位置自动高亮左侧大纲中对应的章节标题

#### Scenario: 短文章自动隐藏大纲
- **WHEN** 文章字数少于500字或无明显章节结构
- **THEN** 系统自动隐藏左侧大纲栏

### Requirement: Lightbox图片查看器
系统SHALL支持点击文章中的图片打开全屏查看器，提供放大、旋转、下载功能。

#### Scenario: 点击图片打开Lightbox
- **WHEN** 用户点击文章中的图片
- **THEN** 系统打开全屏Lightbox，显示高清图片

#### Scenario: Lightbox支持缩放和旋转
- **WHEN** Lightbox打开状态
- **THEN** 系统支持鼠标滚轮缩放、双击放大、旋转按钮旋转图片

#### Scenario: Lightbox支持键盘快捷键
- **WHEN** Lightbox打开状态
- **THEN** 系统支持Esc关闭、← → 切换上下张图片、+/- 缩放

#### Scenario: Lightbox提供下载按钮
- **WHEN** Lightbox打开状态
- **THEN** 系统显示下载按钮，点击可保存原图到本地

### Requirement: 视频智能播放器
系统SHALL提供功能丰富的视频播放器，支持自适应画幅、倍速、循环、截帧、画中画等功能。

#### Scenario: 自适应横屏视频显示
- **WHEN** 视频画幅为16:9或更宽
- **THEN** 系统居中显示视频，两侧黑色背景

#### Scenario: 自适应竖屏视频显示
- **WHEN** 视频画幅为9:16或更窄
- **THEN** 系统居中显示视频，两侧使用高斯模糊填充，适应桌面端

#### Scenario: 倍速播放控制
- **WHEN** 用户点击倍速按钮
- **THEN** 系统显示倍速选项（0.5x、0.75x、1.0x、1.25x、1.5x、2.0x、3.0x），点击后立即生效

#### Scenario: 循环区间播放
- **WHEN** 用户在进度条上拖动选择区间（如00:15-00:25）
- **THEN** 系统循环播放该区间，用于反复听写校对

#### Scenario: 一键截帧保存
- **WHEN** 用户点击截帧按钮
- **THEN** 系统截取当前画面，保存到Supabase Storage，自动创建视频批注（包含截图和时间戳）

#### Scenario: 画中画模式
- **WHEN** 用户点击画中画按钮
- **THEN** 视频缩小为悬浮窗，用户可边看视频边滚动查看内容

#### Scenario: 静音阅读模式
- **WHEN** 用户启用静音阅读模式
- **THEN** 视频默认静音播放，用户依赖右侧高亮字幕阅读

### Requirement: ASR逐字稿系统
系统SHALL支持视频/音频自动转写为逐字稿，提供卡拉OK式高亮、双向交互、说话人识别、校对编辑功能。

#### Scenario: 用户手动触发转写
- **WHEN** 用户在视频页面点击"生成逐字稿"按钮
- **THEN** 系统调用腾讯云ASR API，创建转写任务，显示进度提示

#### Scenario: 转写完成显示逐字稿
- **WHEN** ASR转写任务完成
- **THEN** 系统在右侧边栏显示完整逐字稿，按时间分段

#### Scenario: 卡拉OK式高亮滚动
- **WHEN** 视频播放过程中
- **THEN** 系统根据播放进度逐词高亮逐字稿文字，自动滚动到当前位置

#### Scenario: 点击逐字稿跳转视频
- **WHEN** 用户点击右侧逐字稿中的某段文字
- **THEN** 系统视频seek到对应时间戳，开始播放

#### Scenario: 说话人识别和重命名
- **WHEN** 逐字稿包含多个说话人
- **THEN** 系统用不同颜色区分说话人（如"说话人A"、"说话人B"），用户可点击重命名为"主持人"、"嘉宾"等

#### Scenario: 校对模式编辑逐字稿
- **WHEN** 用户启用校对模式
- **THEN** 系统允许直接编辑逐字稿文字，修正ASR识别错误，编辑后保存到数据库

#### Scenario: 导出SRT字幕文件
- **WHEN** 用户点击"导出SRT"按钮
- **THEN** 系统根据逐字稿和时间戳生成标准SRT字幕文件，供用户下载

### Requirement: 智能章节生成
系统SHALL为视频内容自动生成章节，支持基于语义或画面转场的智能分段。

#### Scenario: 基于逐字稿AI生成章节
- **WHEN** 用户点击"生成章节"按钮且逐字稿已存在
- **THEN** 系统调用AI分析逐字稿语义，自动划分章节，每个章节包含标题和起止时间

#### Scenario: 显示章节列表
- **WHEN** 视频章节生成完成
- **THEN** 系统在左侧边栏显示章节列表，包含序号、时间范围、标题

#### Scenario: 点击章节同步跳转
- **WHEN** 用户点击左侧章节列表中的某个章节
- **THEN** 系统视频seek到章节开始时间，右侧逐字稿同步滚动到对应位置

#### Scenario: 播放时高亮当前章节
- **WHEN** 视频播放过程中
- **THEN** 系统根据播放进度自动高亮左侧章节列表中的当前章节

#### Scenario: 手动编辑章节
- **WHEN** 用户点击章节的编辑按钮
- **THEN** 系统允许修改章节标题、调整起止时间，保存后立即生效

### Requirement: 网页存档系统
系统SHALL支持将原网页保存为永久快照（HTML+截图），用于证据留存，防止原链接失效。

#### Scenario: 用户触发创建存档
- **WHEN** 用户在更多操作菜单中点击"创建存档"
- **THEN** 系统使用无头浏览器（Puppeteer）访问原URL，生成单文件HTML和全页截图，上传到Supabase Storage

#### Scenario: 存档创建完成后可查看
- **WHEN** 存档创建成功
- **THEN** 视图切换器中的"网页存档"Tab变为可用，点击后显示保存的HTML快照

#### Scenario: 存档显示原样排版
- **WHEN** 用户查看网页存档
- **THEN** 系统渲染单文件HTML，保留原站样式、图片（内联），与原网页基本一致

#### Scenario: 存档显示元信息
- **WHEN** 用户查看网页存档
- **THEN** 系统在顶部显示存档时间、原始URL、文件大小

#### Scenario: 导出存档HTML
- **WHEN** 用户点击"导出存档"按钮
- **THEN** 系统下载单文件HTML到本地，可离线使用

#### Scenario: 原链接失效时推荐存档
- **WHEN** 系统检测到原始URL返回404或其他错误
- **THEN** 系统在阅读页顶部显示"原链接已失效，查看存档"提示，点击跳转到存档视图

### Requirement: 阅读器个性化设置
系统SHALL提供丰富的阅读器个性化设置，支持全局默认和单篇覆盖。

#### Scenario: 调整图文模式字号
- **WHEN** 用户在Appearance菜单调整字号滑块
- **THEN** 文章字号实时变化（12px-24px），设置自动保存到用户设置

#### Scenario: 调整图文模式行高
- **WHEN** 用户在Appearance菜单调整行高
- **THEN** 文章行高实时变化（1.5-2.5），阅读更舒适

#### Scenario: 切换主题色
- **WHEN** 用户选择主题色（亮色/暗色/护眼/跟随系统）
- **THEN** 页面主题立即切换，设置持久化

#### Scenario: 切换字体
- **WHEN** 用户选择字体（衬线/无衬线/系统/等宽）
- **THEN** 文章字体立即切换，代码块始终使用等宽字体

#### Scenario: 调整视频模式字幕大小
- **WHEN** 用户在Appearance菜单调整字幕大小
- **THEN** 右侧逐字稿和视频字幕字号实时变化

#### Scenario: 单篇文章覆盖全局设置
- **WHEN** 用户在"单篇设置"中调整当前文章的阅读器参数
- **THEN** 系统保存到notes.reader_preferences，该文章使用单篇设置，其他文章仍用全局设置

#### Scenario: 恢复默认设置
- **WHEN** 用户点击"恢复默认"按钮
- **THEN** 系统重置所有阅读器设置为系统默认值

### Requirement: 阅读进度追踪
系统SHALL自动记录用户的阅读进度（滚动位置/播放进度），支持断点续读。

#### Scenario: 滚动时自动保存进度
- **WHEN** 用户在图文模式下滚动文章
- **THEN** 系统节流500ms后自动保存滚动位置和百分比到数据库

#### Scenario: 视频播放时自动保存进度
- **WHEN** 用户播放视频
- **THEN** 系统每5秒自动保存视频播放位置到数据库

#### Scenario: 下次打开自动跳转到上次位置
- **WHEN** 用户重新打开之前阅读过的笔记
- **THEN** 系统延迟1秒后自动滚动到上次阅读位置（图文）或seek到上次播放位置（视频）

#### Scenario: 显示阅读完成百分比
- **WHEN** 用户阅读笔记
- **THEN** 系统在GlobalHeader显示阅读进度条和百分比（如"已读70%"）

#### Scenario: 计算预估阅读时间
- **WHEN** 用户打开图文笔记
- **THEN** 系统根据字数计算预估阅读时间（字数÷300），显示在元信息头（如"约8分钟读完"）

#### Scenario: 累计阅读时长统计
- **WHEN** 用户阅读笔记
- **THEN** 系统使用可见性检测计算实际阅读时长，累加到reading_progress.total_read_time

### Requirement: 更多操作功能
系统SHALL提供丰富的操作功能，包括分享、复制、导出、整理等。

#### Scenario: 分享笔记生成公开链接
- **WHEN** 用户点击"分享"按钮
- **THEN** 系统生成公开链接或分享卡片，可分享到社交媒体

#### Scenario: 复制原链接
- **WHEN** 用户点击"复制链接"→"复制原链接"
- **THEN** 系统复制source_url到剪贴板

#### Scenario: 复制Markdown链接
- **WHEN** 用户点击"复制链接"→"复制Markdown链接"
- **THEN** 系统复制格式为`[标题](URL)`的Markdown链接

#### Scenario: 复制为引用格式
- **WHEN** 用户点击"复制为引用"
- **THEN** 系统复制格式为`> 选中文字 [链接](URL) (访问于 日期)`的引用文本

#### Scenario: 复制内容为纯文本
- **WHEN** 用户点击"复制内容"→"复制纯文本"
- **THEN** 系统复制文章的纯文本内容（去除HTML标签）到剪贴板

#### Scenario: 复制内容为Markdown
- **WHEN** 用户点击"复制内容"→"复制Markdown"
- **THEN** 系统将内容转换为Markdown格式并复制到剪贴板

#### Scenario: 复制内容为HTML
- **WHEN** 用户点击"复制内容"→"复制HTML"
- **THEN** 系统复制内容的HTML源码到剪贴板

#### Scenario: 复制ASR逐字稿（视频专用）
- **WHEN** 用户在视频笔记中点击"复制内容"→"复制ASR逐字稿"
- **THEN** 系统复制完整的逐字稿文本到剪贴板

#### Scenario: 复制快照为HTML
- **WHEN** 用户点击"复制快照"→"复制快照为HTML"且存档已创建
- **THEN** 系统复制网页存档的HTML内容到剪贴板

#### Scenario: 导出为PDF
- **WHEN** 用户点击"导出"→"导出为PDF"
- **THEN** 系统使用打印优化样式生成PDF文件供下载

#### Scenario: 导出为Markdown
- **WHEN** 用户点击"导出"→"导出为Markdown"
- **THEN** 系统将内容转换为Markdown格式，包含标题、正文、批注，供下载

#### Scenario: 导出为TXT
- **WHEN** 用户点击"导出"→"导出为TXT"
- **THEN** 系统将内容转换为纯文本格式供下载

#### Scenario: 导出SRT字幕（视频专用）
- **WHEN** 用户在视频笔记中点击"导出"→"导出SRT字幕"
- **THEN** 系统根据逐字稿和时间戳生成SRT字幕文件供下载

#### Scenario: 导出视频关键帧打包
- **WHEN** 用户在视频笔记中点击"导出"→"导出关键帧打包"
- **THEN** 系统将视频的所有批注截帧图片打包成ZIP文件，包含时间戳信息，供下载

#### Scenario: 导出网页存档HTML
- **WHEN** 用户点击"导出"→"导出网页存档"且存档已创建
- **THEN** 系统下载保存的单文件HTML快照到本地

#### Scenario: 设为星标
- **WHEN** 用户点击"设为星标"按钮
- **THEN** 系统更新notes.is_starred为true，按钮变为"取消星标"

#### Scenario: 移动到文件夹
- **WHEN** 用户点击"移动到文件夹"
- **THEN** 系统显示文件夹选择对话框，选择后更新notes.folder_id

#### Scenario: 编辑元信息
- **WHEN** 用户点击"编辑信息"
- **THEN** 系统打开编辑对话框，允许修改标题、标签、摘要，保存后更新数据库

#### Scenario: 归档笔记
- **WHEN** 用户点击"归档"按钮或阅读完成后手动触发
- **THEN** 系统更新notes.status为'archived'，notes.archived_at为当前时间

#### Scenario: 标记为稍后读
- **WHEN** 用户点击"稍后读"按钮
- **THEN** 系统更新notes.status为'unread'，将笔记移到稍后读列表，自动保存当前阅读进度

#### Scenario: 读到一半自动保存进度
- **WHEN** 用户阅读到一半退出页面
- **THEN** 系统自动保存阅读进度，笔记保持'reading'状态，下次打开继续阅读

#### Scenario: 删除笔记需要二次确认
- **WHEN** 用户点击"删除"按钮
- **THEN** 系统弹出确认对话框，用户确认后才执行删除操作

### Requirement: 边缘情况处理
系统SHALL妥善处理各种边缘情况和异常场景。

#### Scenario: 检测图文中嵌入的视频
- **WHEN** 图文笔记的HTML中包含<video>或<iframe>视频标签
- **THEN** 系统在视频旁显示"提取为视频笔记"按钮，点击后单独创建视频笔记

#### Scenario: 原链接失效时提示
- **WHEN** 系统检测到原始URL返回404或其他错误
- **THEN** 系统禁用"访问原网页"按钮，显示"原链接已失效"提示，推荐查看存档

#### Scenario: 编辑批注时关闭页面提示
- **WHEN** 用户正在编辑批注但尝试关闭页面或离开
- **THEN** 系统弹出Alert确认对话框："有未保存的批注，确定离开？"

#### Scenario: Jina Reader提取失败降级
- **WHEN** Jina Reader API调用失败或超时
- **THEN** 系统降级使用原始content_html，不阻塞页面加载

#### Scenario: ASR转写失败友好提示
- **WHEN** 腾讯云ASR转写失败
- **THEN** 系统显示友好错误信息（如"视频格式不支持"、"时长超过限制"），提供重试按钮

#### Scenario: 存档创建失败提示
- **WHEN** Puppeteer无法访问URL或生成快照失败
- **THEN** 系统显示具体错误原因（如"网站拒绝访问"、"超时"），允许重试

#### Scenario: 未登录时使用localStorage保存设置
- **WHEN** 用户未登录但调整了阅读器设置
- **THEN** 系统将设置保存到浏览器localStorage，登录后提示同步到云端

