# Tasks: Refine Notes List UI

Tasks for implementing the refined notes list UI.

## 1. Card Layout Refactoring
- [ ] Modify `renderNoteCard` in `dashboard-content.tsx` to use a horizontal flex layout (`flex-row`).
    - [ ] Move the cover image container to the right side.
    - [ ] Set fixed dimensions for the thumbnail (e.g., `w-28 h-20`).
    - [ ] Ensure the text container fills the remaining space on the left.

## 2. Content Styling
- [ ] Update title styling: `font-bold`, `text-sm/base`, `line-clamp-2`.
- [ ] Update excerpt styling: `text-xs`, `text-muted-foreground`, `line-clamp-2` (or 1 depending on space).
- [ ] Remove excessive padding/margins to reduce overall card height.

## 3. Footer & Metadata
- [ ] Refine the card footer:
    - [ ] Show favicon/source icon (if available, or fallback icon) + Site Name.
    - [ ] Show relative date (e.g., "2 days ago") or compact date.
    - [ ] Add a visual indicator for highlights (e.g., a small yellow badge with a number).
- [ ] Align tags neatly if they are displayed, or consider hiding them in "Compact" mode if not in the spec.

## 4. Interactions & Polish
- [ ] Update hover states: apply `shadow-md` and `border-primary/20` on hover.
- [ ] Ensure checkbox selection overlay still works correctly with the new layout.
- [ ] Verify responsive behavior (on mobile, maybe stack or keep small thumbnail).

## 5. Verification
- [ ] Check against the reference screenshot.
- [ ] Verify "Compact Card" view mode specifically.

