# Capture Specification Delta

## MODIFIED Requirements

### Requirement: Extract content for saved URLs
The system SHALL use Jina Reader API to fetch and extract readable content for saved article URLs, and store extracted fields in a consistent, well-formatted manner.

#### Scenario: Extraction succeeds with Jina Reader
- **WHEN** a saved article URL is processed through Jina Reader API
- **THEN** the system stores extracted title, description, and formatted content (HTML) with unified news styling

#### Scenario: Extraction fails gracefully
- **WHEN** Jina Reader API fails due to timeout, network error, or service unavailable
- **THEN** the system keeps the note/item with at least the original URL and returns a clear error message to allow the user to retry

#### Scenario: Video content bypasses Jina Reader
- **WHEN** a saved URL is detected as video content (YouTube, Bilibili, Douyin, Kuaishou)
- **THEN** the system skips Jina Reader and uses platform-specific embed URL extraction logic

## ADDED Requirements

### Requirement: Content formatting with news styling
The system SHALL apply standardized news article styling to all extracted content to ensure consistent and optimal reading experience.

#### Scenario: Apply news styling classes
- **WHEN** content is extracted and converted to HTML
- **THEN** the system applies news styling classes (title hierarchy, paragraph spacing, image centering, quote borders) as defined in `docs/tec-news-reader-style.md`

#### Scenario: Responsive layout support
- **WHEN** formatted content is displayed on different devices
- **THEN** the system applies responsive styling rules (desktop: 18px font, mobile: 16px font, adjusted spacing)

### Requirement: Markdown to HTML conversion
The system SHALL convert Jina Reader's Markdown output to clean HTML before storage.

#### Scenario: Convert Markdown to HTML
- **WHEN** Jina Reader returns content in Markdown format
- **THEN** the system converts it to HTML using a Markdown parser (marked) and sanitizes the output

#### Scenario: Preserve content structure
- **WHEN** Markdown contains headings, lists, blockquotes, and images
- **THEN** the converted HTML maintains proper semantic structure and styling hooks

### Requirement: Jina Reader API configuration
The system SHALL support configurable Jina Reader API settings via environment variables.

#### Scenario: API key validation
- **WHEN** the capture API attempts to use Jina Reader
- **THEN** the system validates that `JINA_API_KEY` environment variable is configured and returns a clear error if missing

#### Scenario: Timeout configuration
- **WHEN** calling Jina Reader API
- **THEN** the system applies a 15-second timeout and aborts the request if it exceeds this limit

#### Scenario: Return format specification
- **WHEN** calling Jina Reader API
- **THEN** the system requests Markdown format (`X-Return-Format: markdown`) for easier processing and cleaner output

## REMOVED Requirements

None (all existing requirements are preserved, only enhanced)

## Notes

### Implementation Details
- Jina Reader API endpoint: `https://r.jina.ai/{url}`
- Required headers: `Authorization: Bearer {JINA_API_KEY}`, `X-Return-Format: markdown`, `X-Timeout: 15`
- Video platform detection logic remains unchanged (B站, YouTube, 抖音, 快手)
- News styling classes defined in `lib/services/html-sanitizer.ts` as `NEWS_STYLING_CLASSES`

### Backward Compatibility
- Existing notes are not affected (no migration needed)
- API response format remains the same (`{ success: true/false }`)
- Video capture logic completely unchanged

### Dependencies
- External service: Jina Reader API (requires API key)
- npm package: `marked` (Markdown to HTML conversion)
- Existing: `cheerio`, `@tailwindcss/typography`
