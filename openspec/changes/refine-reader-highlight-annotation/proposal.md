# Proposal: Refine Reader Highlight and Annotation

This proposal outlines the optimization of the news reader's text selection toolbar and the integration of highlights and annotations into a unified feature, matching the provided UI reference images.

## Problem Statement
The current text selection toolbar is basic and does not match the desired aesthetic. Furthermore, highlights and annotations are treated as separate features, which creates a disconnected user experience. Users expect a seamless flow where highlighting can lead to adding a note, and both are persisted and displayed together.

## Objectives
- **UI Refinement**: Redesign the `SelectionMenu` to match the circular color selectors and toolbar layout from the reference images.
- **Unified Logic**: Treat highlights and annotations as a single entity. Every annotation should be associated with a highlight.
- **Workflow Optimization**:
    - Selecting a color immediately creates a highlight using that color.
    - The "last used color" is remembered for future selections.
    - "Add Annotation" opens a note-taking interface for the current highlight.
- **Enhanced Sidebar**: The right-side annotation list should display both the highlighted text and the associated notes, if any.
- **Persistence**: Ensure all data (including range offsets for precise positioning) is correctly saved to Supabase.

## Proposed Changes

### UI/UX
- Update `SelectionMenu.tsx` with:
    - Circular color buttons (yellow, green, blue, pink, purple).
    - Icons for Highlight Pen (toggle/default), Annotation (note), Copy, AI, and More options.
    - Improved positioning and animation.
- Update `AnnotationList.tsx` in the right sidebar to show a more modern, card-like list of annotations that includes the highlighted text.

### Implementation Details
- **Selection Flow**:
    1. User selects text.
    2. `SelectionMenu` appears.
    3. User clicks a color: `handleHighlight` is called, creating a record in `highlights` table.
    4. User clicks "Annotate": `handleAnnotate` is called, opening the `AnnotationDialog`.
    5. User clicks "Copy": Text is copied to clipboard.
- **Data Unification**:
    - Modify the save logic to ensure annotations are linked to highlights via `highlight_id`.
    - Store the `lastUsedColor` in `localStorage` or `user_settings`.
- **Display**:
    - `ArticleReader` continues to render `highlights` using the improved character-offset injection logic.
    - `AnnotationList` fetches both `highlights` and linked `annotations` to show a unified view.

## Success Criteria
- The toolbar matches the provided images in style and behavior.
- Highlighting text persists correctly across page refreshes.
- Annotations appear in the right sidebar immediately after saving.
- The "last used color" is correctly remembered.

