## ADDED Requirements

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


