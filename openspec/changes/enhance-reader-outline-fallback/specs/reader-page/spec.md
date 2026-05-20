## ADDED Requirements
### Requirement: Article Outline Fallback Cards
The reader page SHALL avoid empty left-sidebar space for article notes by showing useful fallback cards when a semantic article outline cannot be extracted.

#### Scenario: Render real outline when headings exist
- **WHEN** an article contains at least two usable `h1`, `h2`, or `h3` headings
- **THEN** the left sidebar displays the extracted navigable outline and keeps scroll-based active heading behavior

#### Scenario: Render reading clues from article content
- **WHEN** an article has fewer than two usable headings but contains meaningful title, excerpt, metadata, or paragraphs
- **THEN** the left sidebar displays compact reading clue cards derived from the current article content, without calling external hot-news sources

#### Scenario: Render inspiration fallback when content is sparse
- **WHEN** an article has too little usable text to derive reading clues
- **THEN** the left sidebar displays deterministic local inspiration cards from built-in quotes and reflection prompts, selected by date and note identity

#### Scenario: Preserve reader visual quality
- **WHEN** fallback cards are rendered
- **THEN** they support light/dark mode, use concise card styling, include subtle motion that respects reduced-motion preferences, and do not block the main reading content
