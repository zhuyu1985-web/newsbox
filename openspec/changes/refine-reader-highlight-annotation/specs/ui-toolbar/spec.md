# UI Toolbar Spec Delta

## MODIFIED Requirements
### Requirement: Highlight text in note content
The system SHALL provide a refined floating toolbar for text selection actions that matches the modern NewsBox-style aesthetic.

#### Scenario: Selection toolbar appearance
- **WHEN** the user selects text in the reader
- **THEN** a floating toolbar appears containing:
    - Five circular color selectors: Yellow, Green, Blue, Pink, Purple.
    - Action icons: Highlight Pen (default), Annotation Note, Copy, AI Interpretation.
    - Visual style matching the reference images (rounded corners, subtle shadows).

#### Scenario: Selection toolbar positioning
- **WHEN** the toolbar is displayed
- **THEN** it is positioned above the selected text range, centered horizontally, and remains visible during scrolling within the reader area.

