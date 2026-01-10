# quote-materials Specification (Delta)

## ADDED Requirements

### Requirement: Quote materials storage and traceability
The system SHALL store quote materials as user-owned records and preserve traceability back to the source note (and optionally highlight/annotation).

#### Scenario: View material with source
- **WHEN** a quote material is displayed
- **THEN** the UI shows the material text and a reference to the source note that can be opened

#### Scenario: Enforce user ownership
- **WHEN** a user lists, creates, or deletes quote materials
- **THEN** the system scopes all operations to records owned by the authenticated user

### Requirement: List and manage quote materials in Knowledge Base
The system SHALL provide a “金句素材” view under Knowledge Base that lists quote materials and supports common actions.

#### Scenario: List quote materials
- **WHEN** the user opens Knowledge Base → “金句素材”
- **THEN** the system lists quote materials ordered by recency with empty/loading/error states

#### Scenario: Copy a quote material
- **WHEN** the user chooses to copy a quote material
- **THEN** the system copies the material text to clipboard

#### Scenario: Open the source note
- **WHEN** the user clicks the source reference of a quote material
- **THEN** the system navigates to the source note detail

#### Scenario: Delete a quote material
- **WHEN** the user deletes a quote material
- **THEN** the system removes it and the list updates without requiring a full reload

### Requirement: LLM-based quote extraction for a note
The system SHALL allow the user to trigger LLM-based extraction of quote materials from a single note’s content and store the results.

#### Scenario: Trigger extraction
- **WHEN** the user triggers “自动提取金句” for a note
- **THEN** the system runs extraction against that note’s content and stores up to a defined maximum number of materials

#### Scenario: Prevent hallucinated materials
- **WHEN** the LLM returns candidate quote text that does not appear in the note’s source text
- **THEN** the system SHALL NOT store that candidate as a quote material

#### Scenario: Deduplicate extracted results
- **WHEN** extraction is run multiple times for the same note
- **THEN** the system avoids storing duplicates for identical material text under the same user and note

