# capture Specification

## Purpose
TBD - created by archiving change add-ai-news-reading-assistant. Update Purpose after archive.
## Requirements
### Requirement: Capture a web URL into the library
The system SHALL allow a signed-in user to save a web URL as a new note/item in the user's library.

#### Scenario: Save succeeds with minimal data
- **WHEN** the user submits a valid URL
- **THEN** the system creates a new note/item that stores the URL and is visible in the library list

#### Scenario: Save is rejected for invalid URL
- **WHEN** the user submits an invalid URL
- **THEN** the system rejects the request and indicates the URL is invalid

### Requirement: Extract content for saved URLs
The system SHALL attempt to fetch and extract readable content for a saved URL and store extracted fields on the note/item.

#### Scenario: Extraction succeeds
- **WHEN** a saved URL is fetchable and extractable
- **THEN** the system stores extracted title and main content for the note/item

#### Scenario: Extraction fails gracefully
- **WHEN** extraction fails for any reason
- **THEN** the system keeps the note/item with at least the original URL and allows the user to retry extraction

### Requirement: Support multiple content types
The system SHALL support capturing and storing different content types including articles (text/images), videos, and audio.

#### Scenario: Capture article content
- **WHEN** a user saves a URL pointing to an article or blog post
- **THEN** the system identifies it as article type and extracts text content, images, and metadata

#### Scenario: Capture video content
- **WHEN** a user saves a URL pointing to a video (e.g., YouTube, Bilibili)
- **THEN** the system identifies it as video type and extracts video metadata (title, thumbnail, duration, video URL)

#### Scenario: Capture audio content
- **WHEN** a user saves a URL pointing to audio content (e.g., podcast, music)
- **THEN** the system identifies it as audio type and extracts audio metadata (title, cover image, duration, audio URL)

#### Scenario: Content type detection
- **WHEN** a URL is saved
- **THEN** the system automatically detects the content type (article/video/audio) based on URL patterns or page metadata

### Requirement: Idempotent capture behavior
The system SHALL prevent accidental duplicates when the same user saves the same URL multiple times within a short time window.

#### Scenario: Duplicate URL saved twice
- **WHEN** the user submits the same URL twice
- **THEN** the system indicates an existing item already exists or merges the request without creating an unintended duplicate

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

