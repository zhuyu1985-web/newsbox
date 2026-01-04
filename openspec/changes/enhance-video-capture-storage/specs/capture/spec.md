## MODIFIED Requirements

### Requirement: Extract content for saved URLs
The system SHALL attempt to fetch and extract readable content for a saved URL and store extracted fields on the note/item. For video URLs from platforms like Douyin (抖音) and Bilibili (B站), the system SHALL also download the video file and store it in Supabase Storage.

#### Scenario: Extraction succeeds
- **WHEN** a saved URL is fetchable and extractable
- **THEN** the system stores extracted title and main content for the note/item

#### Scenario: Extraction fails gracefully
- **WHEN** extraction fails for any reason
- **THEN** the system keeps the note/item with at least the original URL and allows the user to retry extraction

#### Scenario: Video file download succeeds
- **WHEN** a user saves a video URL from a supported platform (e.g., Douyin, Bilibili)
- **THEN** the system downloads the video file, stores it in Supabase Storage under `{user_id}/videos/{timestamp}-{filename}`, and updates the note's `media_url` field with the Supabase Storage public URL

#### Scenario: Video file download fails gracefully
- **WHEN** video file download fails (network error, platform restrictions, etc.)
- **THEN** the system keeps the note/item with the original video URL in `source_url` and `media_url` fields, allowing the user to retry download later

### Requirement: Support multiple content types
The system SHALL support capturing and storing different content types including articles (text/images), videos, and audio. For video content, the system SHALL download and store video files in Supabase Storage when possible.

#### Scenario: Capture article content
- **WHEN** a user saves a URL pointing to an article or blog post
- **THEN** the system identifies it as article type and extracts text content, images, and metadata

#### Scenario: Capture video content
- **WHEN** a user saves a URL pointing to a video (e.g., YouTube, Bilibili, Douyin)
- **THEN** the system identifies it as video type, extracts video metadata (title, thumbnail, duration, video URL), downloads the video file to Supabase Storage if supported, and updates the note's `media_url` with the stored video URL

#### Scenario: Capture audio content
- **WHEN** a user saves a URL pointing to audio content (e.g., podcast, music)
- **THEN** the system identifies it as audio type and extracts audio metadata (title, cover image, duration, audio URL)

#### Scenario: Content type detection
- **WHEN** a URL is saved
- **THEN** the system automatically detects the content type (article/video/audio) based on URL patterns or page metadata

#### Scenario: Video news capture and storage
- **WHEN** a user saves a video news URL (e.g., news video from Douyin, Bilibili)
- **THEN** the system creates a complete news note with video metadata and stores the video file in Supabase Storage, forming a complete news note entry


