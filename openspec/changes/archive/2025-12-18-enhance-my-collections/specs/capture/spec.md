## ADDED Requirements
### Requirement: Manual quick note capture
The system SHALL allow a user to create a note without providing a URL by直接输入文本内容。

#### Scenario: Create quick note
- **WHEN**用户在“速记”模式提交正文（可含富文本/Markdown）
- **THEN**系统立即创建一个 note，保存文本/富文本内容并在列表中可见

#### Scenario: Validate quick note input
- **WHEN**用户提交空内容或超过长度限制
- **THEN**系统拒绝请求并给出可读的错误提示

### Requirement: Media/file upload capture
The system SHALL allow用户上传图片、视频或常规文件并把文件存储到受控对象存储，再在库中生成对应笔记。

#### Scenario: Upload supported file
- **WHEN**用户选择受支持的图片/视频/文件并提交
- **THEN**系统将文件上传至 Supabase Storage（或等效存储），记录可访问 URL/元信息，并在笔记中展示缩略图/附件信息

#### Scenario: Reject unsupported file
- **WHEN**用户上传类型/尺寸不被允许的文件
- **THEN**系统阻止上传并提示允许的类型与最大尺寸

### Requirement: Multi-mode capture entry state
The system SHALL允许 capture API 根据 `source_type`（url/manual/upload） 识别不同入口，便于后续筛选与统计。

#### Scenario: Persist capture source
- **WHEN**用户通过任意入口创建笔记
- **THEN**系统在 note 上记录 source_type，并可用于分类过滤或统计
