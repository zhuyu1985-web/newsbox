# Annotation Logic Spec Delta

## MODIFIED Requirements
### Requirement: Add annotations to highlights
The system SHALL treat highlights and annotations as a unified entity to streamline the knowledge capturing process.

#### Scenario: Unified creation flow
- **WHEN** the user selects a color in the selection toolbar
- **THEN** a highlight record is immediately created.
- **AND** the system remembers the "last used color" for subsequent selections.

#### Scenario: Linking annotations to highlights
- **WHEN** the user adds a note via the "Annotation Note" button in the selection toolbar
- **THEN** the system creates or updates an `annotation` record that is explicitly linked to the current `highlight_id`.

#### Scenario: Unified sidebar display
- **WHEN** viewing the right-side annotation list
- **THEN** the system displays a unified card for each highlight, showing:
    - The highlight's color as a visual accent (e.g., left border).
    - The quoted text from the highlight.
    - The associated note content, if an annotation exists.

#### Scenario: Database persistence
- **WHEN** a highlight or annotation is created or updated
- **THEN** it is immediately persisted to the Supabase backend, including precise character offsets for the highlight.

