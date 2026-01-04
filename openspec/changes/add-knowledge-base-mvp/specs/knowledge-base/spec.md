# knowledge-base Specification (Delta)

## ADDED Requirements

### Requirement: Knowledge Base global Q&A
The system SHALL provide a Knowledge Base view that allows the user to ask questions across their saved content and receive a synthesized answer.

#### Scenario: Ask a question across the library
- **WHEN** the user opens the Knowledge Base and submits a question
- **THEN** the system retrieves relevant user-owned items (see corpus coverage below) and generates an answer

#### Scenario: Follow-up questions
- **WHEN** the user asks a follow-up question in the same session
- **THEN** the system uses prior messages plus newly retrieved context to respond

### Requirement: P0 retrieval corpus coverage
The system SHALL include the following content as retrievable corpus in P0 (user-owned / `user_id` scoped):
- `notes`: `title`, `excerpt`, `content_text`, `site_name`, `source_url`
- `highlights`: `quote` (optionally `timecode`)
- `annotations`: `content` (optionally associated `highlights.quote`)
- `transcripts`: `full_text` (optionally segment text snippets)
- `ai_outputs`: `summary` (optionally `transcript`)

#### Scenario: Retrieve from non-note items
- **WHEN** the user asks a question that best matches a highlight / annotation / transcript snippet
- **THEN** the system MAY use that snippet as evidence context while still attributing the citation to the owning note

### Requirement: Answer citations and traceability
The system SHALL display citations for knowledge answers, allowing the user to open the referenced original notes.

#### Scenario: Show cited sources
- **WHEN** the system returns a knowledge answer
- **THEN** the UI lists the cited notes with title and source URL (and MAY show the evidence snippet/type)

#### Scenario: Open a cited note
- **WHEN** the user clicks a citation
- **THEN** the system navigates to the note detail page for that note

### Requirement: User-scoped retrieval and privacy
The system SHALL scope knowledge retrieval to the authenticated user’s data.

#### Scenario: Prevent cross-user retrieval
- **WHEN** the user asks a question
- **THEN** the system only retrieves notes/items where `user_id` matches the authenticated user
