# Proposal: Refine Notes List UI

This proposal outlines the refinement of the news notes list UI to match a more modern, compact card style as seen in NewsBox.

## Problem Statement
The current compact card view is too tall, wasting vertical space and displaying cover images prominently at the top, which differs from the desired compact "title + snippet + right thumbnail" layout.

## Objectives
- **Compact Card Layout**: Implement a dense card design.
- **Right-Side Thumbnail**: Move cover images to the right side (small square or 16:9 thumbnail).
- **Metadata Refinement**: Optimize the footer to show source icon, domain, date, and highlighting/annotation indicators.
- **Visual Polish**: Add subtle shadows, bold titles, and clean typography.

## Proposed Changes

### UI Components
- **Dashboard Content (`dashboard-content.tsx`)**:
    - Refactor `renderNoteCard` to use a `flex-row` layout instead of `flex-col`.
    - Limit card height and text lines (clamp).
    - Add a "highlight count" badge (yellow square) if data is available (requires schema check or mock for now).
    - Update typography: bolder titles, lighter snippets.
    - Add hover effects: shadow-md, lift up slightly.

### Visual Style
- **Thumbnail**: Fixed width/height (e.g., `w-24 h-24` or `w-32 h-24`), object-cover, rounded corners.
- **Content**: Left side takes remaining space.
- **Footer**: Flex row with small icons and text (12px).

## Success Criteria
- The list view closely resembles the provided screenshot.
- Cards are significantly shorter in height.
- Information density is increased without looking cluttered.

