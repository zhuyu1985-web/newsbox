# knowledge-base Specification (Delta)

## MODIFIED Requirements

### Requirement: Smart Topics (P1 自动专题构建)
The system SHALL provide a Smart Topics sub-view under Knowledge Base that restructures unstructured saved items into structured topics and narrative timelines, and allows users to curate the results.

#### Scenario: Generate topics on demand
- **WHEN** the user opens Knowledge Base → Smart Topics and clicks “生成/刷新专题”
- **THEN** the system generates topic clusters from the user’s saved notes and persists the results
- **AND** the UI SHALL keep existing topic list content visible while syncing new results

#### Scenario: Scheduled nightly refresh
- **WHEN** it is 2:00 AM in the scheduled job window
- **THEN** the system performs an incremental refresh for the user’s changed/new notes
- **AND** topics updated by the refresh SHALL be marked as updated (e.g., New indicator)

#### Scenario: Browse a topic as a narrative
- **WHEN** the user opens a topic detail page
- **THEN** the system shows (1) a topic report summary and (2) a smart timeline organized by event time

#### Scenario: Deduplicate multiple reports into one timeline node
- **WHEN** multiple notes describe the same event
- **THEN** the system groups them into a single timeline node and shows those notes as evidence under that node

#### Scenario: Human-in-the-loop curation
- **WHEN** the user manually adds/removes a note from a topic or confirms membership (pin)
- **THEN** the system persists the override and the curated state SHALL take precedence over automatic clustering

#### Scenario: Merge topics
- **WHEN** the user merges Topic A into Topic B
- **THEN** the system combines memberships, rebuilds timeline nodes, and regenerates the topic report

#### Scenario: Topic lifecycle
- **WHEN** a topic has no new ingested notes for 30 days and is not pinned
- **THEN** the system auto-archives it and hides it from the default gallery, while keeping it accessible in an archive view

## ADDED Requirements

### Requirement: Topic Gallery UX
The system SHALL provide a Topic Gallery view for Smart Topics that surfaces topic metadata (counts, span, key entities, update status) and supports pinning and archiving.

#### Scenario: Show stable layout during sync
- **WHEN** the topic gallery is syncing
- **THEN** the layout height SHALL remain stable and the current list content remains visible (no blank flicker)

### Requirement: Topic editing actions
The system SHALL provide topic editing actions including pin/unpin, archive/unarchive, and merge.

#### Scenario: Pin a topic
- **WHEN** the user pins a topic
- **THEN** the topic appears at the top of the gallery and remains visible regardless of auto-archiving rules

### Requirement: Privacy and access control for Smart Topics
The system SHALL enforce user-scoped access for topics, topic members, and timeline nodes.

#### Scenario: Prevent cross-user timeline access
- **WHEN** the user attempts to access a timeline node not owned by them
- **THEN** the system denies access and returns an authorization error
