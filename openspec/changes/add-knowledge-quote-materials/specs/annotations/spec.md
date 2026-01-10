# annotations Specification (Delta)

## ADDED Requirements

### Requirement: Mark an annotation as a quote material
The system SHALL allow a user to mark an existing annotation (批注) as a quote material (金句素材) from both the annotations list and the reading experience.

#### Scenario: Mark from annotations list
- **WHEN** the user opens the annotations list and chooses “设为金句素材” on an annotation
- **THEN** the system creates a quote material linked to that annotation and shows a success state

#### Scenario: Mark from reading sidebar
- **WHEN** the user opens a note in reading view and chooses “设为金句素材” on an annotation card
- **THEN** the system creates a quote material linked to that annotation and indicates the saved state on the card

#### Scenario: Unmark / remove
- **WHEN** the user chooses “取消金句素材” (or deletes the quote material) for an annotation that was previously marked
- **THEN** the system removes the corresponding quote material and updates UI state accordingly

