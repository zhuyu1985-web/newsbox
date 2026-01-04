# knowledge-base Specification (Delta)

## ADDED Requirements

### Requirement: Smart Topics (P1 自动专题构建)
The system SHALL provide a Smart Topics sub-view under Knowledge Base that automatically clusters the user’s saved items into topics and allows browsing topic timelines and reports.

#### Scenario: Generate topics on demand
- **WHEN** the user opens Knowledge Base → Smart Topics and clicks “生成/刷新专题”
- **THEN** the system generates topic clusters from the user’s saved notes and persists the results

#### Scenario: Browse a topic timeline
- **WHEN** the user opens a topic detail page
- **THEN** the system shows the topic’s member notes ordered by time (prefer `published_at`, fallback to `created_at`)

#### Scenario: Generate a topic report
- **WHEN** the user requests a “专题报告”
- **THEN** the system produces a structured Markdown report with citations that can be traced back to notes

### Requirement: Topic data persistence
The system SHALL persist Smart Topics results so that the user can revisit and continue browsing after closing and reopening the browser.

#### Scenario: Reopen and see previous topics
- **WHEN** the user revisits Knowledge Base
- **THEN** previously generated topics and their member notes are available without needing to regenerate immediately

### Requirement: User-scoped topics and privacy
The system SHALL scope topic generation and browsing to the authenticated user’s data.

#### Scenario: Prevent cross-user topic access
- **WHEN** the user attempts to access a topic not owned by them
- **THEN** the system denies access and returns an authorization error
