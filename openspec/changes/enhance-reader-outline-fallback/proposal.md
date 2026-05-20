# Change: Enhance Reader Outline Fallback

## Why
Many saved news articles do not contain semantic `h1`/`h2`/`h3` headings after extraction, so the reader left sidebar often shows an empty outline state and wastes screen space.

## What Changes
- Keep the real article outline when enough headings exist.
- When headings are missing, derive concise reading clue cards from the current article's paragraphs, title, excerpt, and source metadata.
- When the article has too little usable text, show deterministic local inspiration cards sourced from built-in quotes and reflection prompts.
- Add a compact animated card presentation for the fallback state that works in light and dark reader themes.

## Impact
- Affected specs: `reader-page`
- Affected code: `components/reader/LeftSidebar/ArticleOutline.tsx`, `components/reader/LeftSidebar/index.tsx`, new reader outline utility/tests
