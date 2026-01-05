# Design: Refine Reader Highlight and Annotation

This document details the architectural and implementation design for unifying highlights and annotations and refining the reader's selection UI.

## 1. Unified Entity Model

Highlights and Annotations will be treated as a single "Knowledge Fragment":
- **Highlight (Required)**: The "anchor" in the text (quote, offsets, color).
- **Annotation (Optional)**: The user's "commentary" on that anchor.

### Database Relationship
- `highlights` table remains the source of truth for text ranges.
- `annotations` table will now ALWAYS link to a `highlight_id` when created from the reader.
- If a user deletes a highlight, the associated annotation should be deleted (Cascading delete already exists in schema).

## 2. Component Architecture

### SelectionMenu (`SelectionMenu.tsx`)
- **Visuals**:
    - Circular color buttons using `div` with `rounded-full`.
    - `Lucide` icons for actions.
    - Floating layout with `createPortal`.
- **Logic**:
    - `lastUsedColor`: Persisted in `localStorage` or a new `ReaderContext`.
    - `onHighlight`: Debounced or immediate save to database.
    - `onAnnotate`: Triggers the annotation flow.

### Annotation Flow
1. **Highlight Creation**: As soon as a color is selected, a `highlight` record is created.
2. **Annotation Attachment**: If the "Note" icon is clicked, `AnnotationDialog` is shown. Saving the note creates/updates an `annotation` record linked to the `highlight_id` created in step 1.

### Unified Sidebar (`AnnotationList.tsx`)
- Instead of just `annotations`, it should perform a joined query or fetch both and merge them.
- **Display Card**:
    - Left border color matches the highlight color.
    - Shows `quote` text.
    - Shows `content` (note) if present.

## 3. Implementation Details

### Precise Positioning
We will continue using the `globalStart` and `globalEnd` offsets implemented in `ArticleReader.tsx` to ensure highlights don't "shift" when the content is re-rendered or scrolled.

### Last Used Color
Store the hex code or color name in `localStorage` under `newsbox_reader_last_color`.

## 4. UI/UX Styles
- **Toolbar**: Border radius `12px`, subtle shadow `0 4px 20px rgba(0,0,0,0.1)`, translucent background if possible.
- **Highlights in Text**: Use `<mark>` with background colors matching the toolbar:
    - Yellow: `rgba(254, 240, 138, 0.5)`
    - Green: `rgba(187, 247, 208, 0.5)`
    - Blue: `rgba(191, 219, 254, 0.5)`
    - Pink: `rgba(251, 207, 232, 0.5)`
    - Purple: `rgba(233, 213, 255, 0.5)`

