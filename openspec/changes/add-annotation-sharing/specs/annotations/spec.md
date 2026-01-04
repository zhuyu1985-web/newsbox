## ADDED Requirements

### Requirement: Mark annotations as shareable
The system SHALL allow users to mark specific annotations as shareable or keep them private by default.

#### Scenario: Annotation defaults to private
- **WHEN** a user creates a new annotation
- **THEN** the system sets `is_shareable = false` by default to protect user privacy

#### Scenario: Enable sharing for an annotation
- **WHEN** the user explicitly enables sharing for an annotation
- **THEN** the system updates `is_shareable = true` and allows the annotation to be included in share links

#### Scenario: Disable sharing for an annotation
- **WHEN** the user disables sharing for an annotation that is part of active share links
- **THEN** the system updates `is_shareable = false` and excludes the annotation from all future share link accesses (existing share links no longer display this annotation)

### Requirement: Display share status in annotation UI
The system SHALL visually indicate whether an annotation is shareable and how many active share links reference it.

#### Scenario: Show share indicator for shareable annotation
- **WHEN** an annotation has `is_shareable = true`
- **THEN** the system displays a share icon or badge on the annotation card in the reader sidebar

#### Scenario: Show share link count
- **WHEN** an annotation is included in one or more active share links
- **THEN** the system displays the count of active share links referencing this annotation

#### Scenario: Quick toggle share status
- **WHEN** the user clicks the share indicator on an annotation
- **THEN** the system toggles the `is_shareable` flag and updates the UI immediately

### Requirement: Preserve annotation metadata for sharing
The system SHALL ensure shared annotations include all necessary context for recipients to understand the content.

#### Scenario: Include quote text in shared annotation
- **WHEN** an annotation with a highlight quote is shared
- **THEN** the shared view displays the `quote_text` with proper formatting and visual distinction

#### Scenario: Include user notes in shared annotation
- **WHEN** an annotation with `note_text` is shared
- **THEN** the shared view displays the user's commentary alongside the quote

#### Scenario: Include screenshots for video annotations
- **WHEN** a video annotation with `screenshot_url` is shared
- **THEN** the shared view displays the screenshot image with proper referrer policy handling

#### Scenario: Include timecodes for media annotations
- **WHEN** a media annotation with `timecode` is shared
- **THEN** the shared view displays the timestamp in human-readable format (MM:SS)
