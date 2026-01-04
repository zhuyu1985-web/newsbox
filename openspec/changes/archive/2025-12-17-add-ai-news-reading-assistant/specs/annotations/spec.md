## ADDED Requirements

### Requirement: Highlight text in note content
The system SHALL allow a user to highlight selected text ranges in the rendered note content.

#### Scenario: Create highlight from selection
- **WHEN** the user selects text in the note content and chooses to highlight
- **THEN** the system creates a highlight record storing the selected quote and position information

#### Scenario: Highlight persists across sessions
- **WHEN** a highlight is created
- **THEN** the system stores it and displays it when the user views the note/item later

### Requirement: Add annotations to highlights
The system SHALL allow a user to add text annotations (批注) to highlights or directly to notes.

#### Scenario: Annotate a highlight
- **WHEN** the user adds an annotation to an existing highlight
- **THEN** the system associates the annotation with the highlight and displays it together

#### Scenario: Create standalone annotation
- **WHEN** the user creates an annotation without a highlight
- **THEN** the system stores it as a note-level annotation

### Requirement: View and manage highlights and annotations
The system SHALL provide a way for users to view all highlights and annotations for a note and manage them (edit, delete).

#### Scenario: List highlights in reading view
- **WHEN** the user views a note/item that has highlights
- **THEN** the system displays all highlights visually in the content and provides a list/sidebar view

#### Scenario: Edit annotation
- **WHEN** the user edits an existing annotation
- **THEN** the system updates the annotation content

#### Scenario: Delete highlight or annotation
- **WHEN** the user deletes a highlight or annotation
- **THEN** the system removes it and updates the UI accordingly

### Requirement: Highlight positioning and recovery
The system SHALL attempt to preserve highlight positions even if content structure changes, and provide fallback when exact positioning fails.

#### Scenario: Highlight position preserved
- **WHEN** content HTML structure remains stable
- **THEN** highlights are displayed at the correct positions

#### Scenario: Highlight recovery with quote matching
- **WHEN** exact position information becomes invalid
- **THEN** the system attempts to locate highlights by matching stored quote text and allows manual repositioning if needed

