# capture Spec Delta

## ADDED Requirements

### Requirement: Jina Reader内容提取集成
系统SHALL集成Jina Reader API，提供高质量的网页正文提取能力。

#### Scenario: 使用Jina Reader提取正文
- **WHEN** 用户保存URL或刷新笔记内容
- **THEN** 系统优先调用Jina Reader API提取纯净正文、Markdown格式内容

#### Scenario: Jina Reader提取保留结构
- **WHEN** Jina Reader成功提取内容
- **THEN** 系统获得的content_html保留原文结构（标题、段落、列表、代码块），去除广告和无关元素

#### Scenario: Jina Reader失败时降级
- **WHEN** Jina Reader API调用失败、超时或返回空内容
- **THEN** 系统降级使用原有的简单提取方法或保存原始HTML，不阻塞保存流程

#### Scenario: Jina Reader提取缓存
- **WHEN** Jina Reader成功提取内容
- **THEN** 系统将提取结果缓存到notes表，避免重复调用API

### Requirement: 网页存档功能
系统SHALL支持将网页保存为永久快照（单文件HTML+截图），用于证据留存和离线查看。

#### Scenario: 创建网页快照
- **WHEN** 用户点击"创建存档"按钮
- **THEN** 系统使用无头浏览器（Puppeteer）访问原URL，生成单文件HTML（内联CSS、图片）和全页截图

#### Scenario: 快照上传到Supabase Storage
- **WHEN** 快照生成完成
- **THEN** 系统将HTML文件和截图上传到Supabase Storage的archives bucket，记录到web_archives表

#### Scenario: 快照创建失败提示
- **WHEN** 无头浏览器无法访问URL（403、404、超时等）
- **THEN** 系统显示具体错误原因，提供重试选项，不阻塞其他功能

#### Scenario: 快照去重
- **WHEN** 用户为同一笔记多次点击"创建存档"
- **THEN** 系统检测到已存在存档记录，提示"已存在存档，是否覆盖？"，避免重复创建

#### Scenario: 快照自动清理策略
- **WHEN** 存档创建时间超过设定期限（如180天）
- **THEN** 系统通过定时任务自动删除过期存档文件，释放存储空间

### Requirement: 估算阅读时间
系统SHALL在内容提取后自动计算并存储预估阅读时间。

#### Scenario: 计算图文阅读时间
- **WHEN** 内容提取完成后
- **THEN** 系统统计content_text字数，按300字/分钟计算预估阅读时间，存储到notes.estimated_read_time

#### Scenario: 计算视频观看时间
- **WHEN** 视频内容提取完成后
- **THEN** 系统使用media_duration字段（秒），转换为分钟，作为预估观看时间

#### Scenario: 在阅读页显示预估时间
- **WHEN** 用户打开阅读详情页
- **THEN** 系统在元信息头显示"约X分钟读完"或"约X分钟观看"

## MODIFIED Requirements

### Requirement: Extract content for saved URLs
系统SHALL优先使用Jina Reader提取高质量正文，失败时降级到简单提取，并支持手动创建存档。

#### Scenario: Extraction with Jina Reader priority
- **WHEN** 保存的URL可访问且提取开始
- **THEN** 系统首先尝试调用Jina Reader API提取纯净正文和Markdown，成功则存储高质量content_html和content_text

#### Scenario: Extraction fallback to simple method
- **WHEN** Jina Reader提取失败
- **THEN** 系统降级使用简单HTML解析或保存原始HTML，标记extraction_method字段为'fallback'

#### Scenario: Extraction includes estimated read time
- **WHEN** 提取成功
- **THEN** 系统自动计算并存储estimated_read_time，供阅读页显示

#### Scenario: Extraction supports manual archive creation
- **WHEN** 提取成功后用户点击"创建存档"
- **THEN** 系统调用Puppeteer生成快照，存储到web_archives表，与原笔记关联

