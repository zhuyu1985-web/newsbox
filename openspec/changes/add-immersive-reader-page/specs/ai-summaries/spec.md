# ai-summaries Spec Delta

## ADDED Requirements

### Requirement: 多视角AI分析
系统SHALL提供多种视角的AI分析，包括摘要、记者视点、时间线、视觉摘要等，帮助用户全面理解内容。

#### Scenario: 生成记者视点分析
- **WHEN** 用户触发AI解读功能
- **THEN** 系统分析文章的消息源可靠性、利益相关方、潜在偏见，生成"记者视点"分析结果

#### Scenario: 生成事件时间线
- **WHEN** 用户触发AI解读且文章包含事件叙述
- **THEN** 系统提取关键时间节点和事件，生成结构化时间线（时间、事件、来源）

#### Scenario: 生成视频视觉摘要
- **WHEN** 用户为视频内容触发AI解读
- **THEN** 系统识别关键帧和画面场景（如"火灾现场"、"发布会"），生成视觉摘要

#### Scenario: Deepfake检测预警
- **WHEN** 用户为视频内容触发AI解读
- **THEN** 系统检测视频中的AI生成痕迹，如检测到可疑特征则显示"Deepfake预警"提示

#### Scenario: 多视角分析分段展示
- **WHEN** AI解读生成完成
- **THEN** 系统在右侧面板中分段展示各个视角分析，每个视角可独立折叠/展开

### Requirement: AI追问对话功能
系统SHALL支持用户针对文章内容向AI提问，提供RAG增强的问答能力。

#### Scenario: 用户输入追问问题
- **WHEN** 用户在AI解读面板底部输入问题（如"这篇文章对房地产有何利空？"）
- **THEN** 系统基于文章内容调用AI API，生成针对性回答

#### Scenario: 流式渲染AI回复
- **WHEN** AI开始生成回答
- **THEN** 系统使用Server-Sent Events流式渲染回复，逐字显示，提升响应体验

#### Scenario: 保持对话历史
- **WHEN** 用户连续提问
- **THEN** 系统保持对话上下文，AI可基于之前的问答继续对话

#### Scenario: 对话历史可清空
- **WHEN** 用户点击"清空对话"按钮
- **THEN** 系统清空对话历史，下次提问为全新对话

#### Scenario: 对话限制提示
- **WHEN** 用户在短时间内提问过多次
- **THEN** 系统显示rate limit提示（如"请稍后再试"），避免滥用

### Requirement: AI解读流式生成
系统SHALL在生成AI解读时使用流式输出，提升用户体验。

#### Scenario: 点击生成AI解读
- **WHEN** 用户首次打开AI解读面板或点击"生成"按钮
- **THEN** 系统调用AI API，以流式方式逐段显示摘要、记者视点等内容

#### Scenario: 流式生成中可取消
- **WHEN** AI解读流式生成过程中
- **THEN** 系统显示"取消"按钮，用户可中断生成

#### Scenario: 生成完成自动保存
- **WHEN** AI解读流式生成完成
- **THEN** 系统自动将结果保存到ai_outputs表，下次打开直接显示缓存结果

### Requirement: AI解读缓存与更新
系统SHALL缓存已生成的AI解读结果，并在内容变更时提供重新生成选项。

#### Scenario: 已有AI解读直接展示
- **WHEN** 用户打开AI解读面板且已存在ai_outputs记录
- **THEN** 系统直接从数据库读取并展示缓存的AI解读结果，不重复调用API

#### Scenario: 内容更新后提示重新生成
- **WHEN** 笔记内容在AI解读生成后发生变更（content_html更新）
- **THEN** 系统在AI面板顶部显示"内容已更新，重新生成？"提示

#### Scenario: 手动触发重新生成
- **WHEN** 用户点击"重新生成"按钮
- **THEN** 系统调用AI API重新分析，覆盖旧的ai_outputs记录

## MODIFIED Requirements

### Requirement: Generate AI summary for a note
系统SHALL为笔记生成多视角AI分析，包括摘要、记者视点、时间线等，支持手动触发和流式生成。

#### Scenario: Manual trigger for comprehensive analysis
- **WHEN** 用户在阅读页点击"AI解读"按钮
- **THEN** 系统展开右侧AI解读面板，如未生成则流式生成摘要、记者视点、时间线等多维度分析

#### Scenario: Analysis generation with streaming
- **WHEN** AI分析生成过程中
- **THEN** 系统使用Server-Sent Events流式输出，用户实时看到生成进度，可随时取消

#### Scenario: Analysis cached after generation
- **WHEN** AI分析生成完成
- **THEN** 系统将结果存储到ai_outputs表，包含summary、journalist_view、timeline、visual_summary等字段，下次访问直接读取

#### Scenario: Summary generation fails gracefully
- **WHEN** AI summary generation fails (API error, rate limit, etc.)
- **THEN** 系统不阻止阅读和批注功能，显示友好错误提示（如"AI服务暂时不可用"），提供重试按钮

### Requirement: Generate AI summary for video content
系统SHALL为视频内容生成增强的AI分析，包括视觉摘要和Deepfake检测。

#### Scenario: Summarize video with transcript
- **WHEN** 视频笔记已有逐字稿
- **THEN** 系统基于逐字稿生成摘要、时间线，同时分析视觉元素（如关键帧）

#### Scenario: Video summary includes visual elements
- **WHEN** AI分析视频内容
- **THEN** 系统在visual_summary字段中存储关键帧分析、场景识别结果

#### Scenario: Deepfake detection warning
- **WHEN** AI检测到视频可能使用AI生成
- **THEN** 系统在deepfake_warning字段中存储检测结果和置信度，在面板中显示警告提示

#### Scenario: Video summary without transcript fallback
- **WHEN** 视频未转写且无字幕
- **THEN** 系统基于视频元数据（标题、描述、封面）生成简短摘要，提示"转写后可生成详细分析"

### Requirement: AI output storage and retrieval
系统SHALL存储扩展的AI输出字段，包括多视角分析和对话历史。

#### Scenario: Store multi-perspective analysis
- **WHEN** AI分析生成完成
- **THEN** 系统在ai_outputs表中存储summary、journalist_view（JSONB）、timeline（JSONB）、visual_summary（JSONB）、deepfake_warning（JSONB）

#### Scenario: Store video-specific AI outputs
- **WHEN** 为视频内容生成AI分析
- **THEN** 系统额外存储visual_summary（关键帧、场景）和deepfake_warning（检测结果）

#### Scenario: Chat history persistence (optional)
- **WHEN** 用户与AI进行追问对话
- **THEN** 系统可选择性地保存对话历史到JSONB字段，方便用户回顾

#### Scenario: Retrieve analysis efficiently
- **WHEN** 用户打开AI解读面板
- **THEN** 系统通过note_id单次查询获取所有AI分析字段，避免多次数据库请求

