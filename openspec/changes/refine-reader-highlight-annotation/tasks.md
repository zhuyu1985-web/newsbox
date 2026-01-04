# Tasks: Refine Reader Highlight and Annotation

Tasks for implementing the refined selection UI and unified highlight/annotation logic.

## 1. UI Refinement
- [x] Redesign `SelectionMenu.tsx` to match the reference images.
    - [x] Create circular color selectors.
    - [x] Add new icons (Highlight Pen, Note, Copy, AI).
    - [x] Implement smooth animations and improved positioning logic.
- [x] Update `AnnotationDialog.tsx` to be more compact and align with the reader's aesthetic.

## 2. Logic Integration
- [x] Implement `lastUsedColor` persistence in `SelectionMenu`.
- [x] Update `ArticleReader.tsx` and `SelectionMenu.tsx` communication:
    - [x] `onHighlight` should handle the creation of the database record.
    - [x] Ensure `onAnnotate` uses the `highlight_id` from the newly created highlight.
- [x] Update API routes (if necessary) to support linked highlight/annotation creation.

## 3. Sidebar Optimization
- [x] Refactor `AnnotationList.tsx` to fetch both highlights and annotations.
- [x] Update the UI of `AnnotationList` cards to show the highlight color and unified content.
- [x] Add "Jump to" functionality to scroll the reader to the specific highlight when a card in the sidebar is clicked.

## 4. AI & Other Actions
- [x] Connect the "AI" button in `SelectionMenu` to the `AIAnalysisPanel`.
- [x] Implement the "Copy" action with a success feedback state.

## 5. Verification & Cleanup
- [x] Verify that scrolling doesn't break the selection toolbar.
- [x] Ensure all highlights persist and display correctly with the unified model.
- [x] Remove all temporary debug logging.
