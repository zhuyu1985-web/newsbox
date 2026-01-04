# ai-summaries Specification

## Purpose
TBD - created by archiving change add-ai-news-reading-assistant. Update Purpose after archive.
## Requirements
### Requirement: Generate AI summary for a note
The system SHALL generate an AI summary for a note/item when content extraction succeeds or when the user manually requests it.

#### Scenario: Auto-generate summary after extraction
- **WHEN** content extraction succeeds for a saved URL
- **THEN** the system automatically triggers AI summary generation and stores the result

#### Scenario: Manual trigger for summary
- **WHEN** the user clicks "Generate Summary" or "AI解读" on a note/item
- **THEN** the system generates and displays the summary

#### Scenario: Summary generation fails gracefully
- **WHEN** AI summary generation fails (API error, rate limit, etc.)
- **THEN** the system does not block reading/annotation and allows the user to retry or dismiss the AI feature

### Requirement: Generate AI summary for video content
The system SHALL generate an AI summary for video-type notes/items by extracting transcripts/subtitles and summarizing the main content.

#### Scenario: Summarize video with available subtitles
- **WHEN** a video-type note/item has available subtitles or captions
- **THEN** the system extracts the subtitle text and generates a summary based on the transcript

#### Scenario: Summarize video using transcription
- **WHEN** a video-type note/item does not have subtitles but transcription is possible
- **THEN** the system transcribes the video audio and generates a summary based on the transcript

#### Scenario: Video summary includes main points
- **WHEN** AI summary is generated for a video
- **THEN** the system provides a concise summary of the video's main content and key points

#### Scenario: Video transcription fails gracefully
- **WHEN** video transcription fails (unsupported format, API error, etc.)
- **THEN** the system falls back to generating a brief summary using available metadata (title, description) and allows retry

### Requirement: Generate AI summary for audio content
The system SHALL generate an AI summary for audio-type notes/items by transcribing the audio and summarizing the main content.

#### Scenario: Summarize audio using speech-to-text
- **WHEN** an audio-type note/item is processed for AI summary
- **THEN** the system transcribes the audio using speech-to-text and generates a summary based on the transcript

#### Scenario: Audio summary includes main points
- **WHEN** AI summary is generated for an audio item
- **THEN** the system provides a concise summary of the audio's main content and key discussion points

#### Scenario: Audio transcription fails gracefully
- **WHEN** audio transcription fails (unsupported format, API error, etc.)
- **THEN** the system falls back to generating a brief summary using available metadata (title, description) and allows retry

### Requirement: Generate key questions for a note
The system SHALL generate a list of key questions that help users understand the main points of the content.

#### Scenario: Key questions accompany summary
- **WHEN** AI summary is generated for a note/item
- **THEN** the system also generates and displays a list of key questions (typically 3-5 questions)

#### Scenario: Key questions help filtering
- **WHEN** key questions are displayed
- **THEN** users can use them to quickly assess whether the content is worth reading in detail

### Requirement: AI output storage and retrieval
The system SHALL store AI-generated summaries and key questions associated with each note/item and make them retrievable.

#### Scenario: AI output persists
- **WHEN** AI summary and key questions are generated
- **THEN** the system stores them and they remain available when the user views the note/item later

#### Scenario: Store transcript for video/audio
- **WHEN** AI summary is generated for video or audio content
- **THEN** the system optionally stores the transcript text for future reference and search

#### Scenario: View AI output in reading view
- **WHEN** the user opens a note/item that has AI output
- **THEN** the system displays the summary and key questions in the reading interface

#### Scenario: View transcript for video/audio
- **WHEN** the user views a video or audio item that has a stored transcript
- **THEN** the system provides access to view the transcript alongside the summary

### Requirement: User control over AI processing
The system SHALL allow users to control AI processing (e.g., disable auto-generation, delete AI output).

#### Scenario: Disable auto-generation
- **WHEN** the user disables auto-generation in settings
- **THEN** the system does not automatically generate summaries for new items, but still allows manual triggers

#### Scenario: Delete AI output
- **WHEN** the user deletes AI output for a note/item
- **THEN** the system removes the stored AI data and allows regeneration if requested

