# knowledge-base Specification (Delta)

## ADDED Requirements

### Requirement: Automatic Entity Extraction Pipeline
The system SHALL automatically extract entities and relationships from user-saved content without requiring manual triggering.

#### Scenario: Extract entities on note capture
- **WHEN** the user captures/saves a new note (via URL, manual text, or file upload)
- **THEN** the system SHALL trigger entity extraction in the background
- **AND** the extraction SHALL NOT block the user's capture operation

#### Scenario: Background processing queue
- **WHEN** entity extraction is triggered
- **THEN** the system SHALL process the extraction asynchronously using a background job queue
- **AND** the user SHALL be able to continue using the application while extraction is in progress

#### Scenario: Batch extraction for existing notes
- **WHEN** the user clicks "Rebuild Graph" in the knowledge graph view
- **THEN** the system SHALL extract entities from all user-owned notes that have not been processed
- **AND** display progress feedback during batch processing

### Requirement: Entity Deduplication and Resolution
The system SHALL automatically identify and merge duplicate entities based on name similarity.

#### Scenario: Merge similar entities
- **WHEN** a newly extracted entity has a name similar to an existing entity (cosine similarity > 0.85)
- **THEN** the system SHALL merge them into a single entity
- **AND** store both names in the `aliases` array

#### Scenario: Preserve entity relationships during merge
- **WHEN** two entities are merged
- **THEN** all relationships pointing to either entity SHALL be updated to point to the merged entity
- **AND** duplicate relationships SHALL be deduplicated

### Requirement: Evidence Traceability System
The system SHALL provide a mechanism for users to view the evidence and source for each relationship in the knowledge graph.

#### Scenario: View evidence for a relationship
- **WHEN** the user clicks on a relationship edge in the knowledge graph
- **THEN** the system SHALL display a modal showing:
  - The relationship description (e.g., "[Sam Altman] --fired by--> [OpenAI Board]")
  - The original text snippet where the relationship was extracted
  - The source note title and publication date
  - A link to navigate to the source note

#### Scenario: Multiple evidence sources
- **WHEN** a relationship appears in multiple notes
- **THEN** the evidence modal SHALL list all source notes with their respective snippets
- **AND** allow the user to navigate to any of the source notes

#### Scenario: Navigate to source note
- **WHEN** the user clicks a source note link in the evidence modal
- **THEN** the system SHALL navigate to the note detail page
- **AND** optionally highlight the relevant text snippet (if feasible)

### Requirement: Advanced Graph Filtering
The system SHALL provide advanced filtering capabilities to help users focus on relevant entities and relationships.

#### Scenario: Filter by confidence score
- **WHEN** the user adjusts the confidence threshold slider
- **THEN** the system SHALL hide all relationships with confidence scores below the threshold
- **AND** update the graph visualization in real-time

#### Scenario: Filter by relationship type
- **WHEN** the user selects specific relationship types (e.g., "投资", "收购", "合作")
- **THEN** the system SHALL only display relationships of the selected types
- **AND** hide all other relationships

#### Scenario: Stop-words filtering
- **WHEN** the graph is rendered
- **THEN** the system SHALL automatically hide generic entities from a predefined stop-words list (e.g., "记者", "美国", "中国", "今天")
- **AND** provide a toggle to show/hide filtered entities

#### Scenario: Combined filters
- **WHEN** multiple filters are active (confidence + entity type + relationship type)
- **THEN** the system SHALL apply all filters simultaneously using AND logic
- **AND** display a count of visible vs total entities/relationships

### Requirement: Timeline Analysis and Playback
The system SHALL provide a timeline view that allows users to see how the knowledge graph evolved over time.

#### Scenario: View graph at a specific time
- **WHEN** the user selects a date or date range using the timeline slider
- **THEN** the system SHALL display only entities and relationships that existed at that time
- **AND** use the note's `published_at` (or `captured_at`/`created_at` fallback) to determine relationship timestamps

#### Scenario: Animate relationship changes
- **WHEN** the user clicks the "Play" button on the timeline
- **THEN** the system SHALL animate the graph to show relationships being added over time
- **AND** highlight newly added relationships with a visual effect (e.g., pulse animation)

#### Scenario: Filter by date range
- **WHEN** the user selects a date range (e.g., "2023-01 to 2023-06")
- **THEN** the system SHALL display all entities and relationships within that range
- **AND** show a summary of relationship changes (added/removed) during the period

#### Scenario: Relationship change indicators
- **WHEN** viewing the timeline
- **THEN** the system SHALL visually distinguish between:
  - New relationships (green/highlighted)
  - Existing relationships (normal)
  - Changed relationships (e.g., "合作" → "起诉")

### Requirement: Enhanced Entity Profile Panel
The system SHALL provide an enhanced entity profile panel with AI-generated summaries and detailed relationship information.

#### Scenario: Generate AI entity summary
- **WHEN** the user clicks on an entity node
- **THEN** the system SHALL display an AI-generated summary of the entity based on mentions in the user's saved notes
- **AND** cache the summary to avoid redundant API calls

#### Scenario: Display relationship evidence counts
- **WHEN** viewing an entity's relationships in the profile panel
- **THEN** the system SHALL show the number of evidence sources for each relationship
- **AND** allow the user to click to view all evidence

#### Scenario: Show mention timeline
- **WHEN** viewing an entity profile
- **THEN** the system SHALL display a timeline of all notes mentioning the entity
- **AND** sort by publication date (or captured date as fallback)

## MODIFIED Requirements

### Requirement: Knowledge Graph Visualization
The system SHALL provide an interactive force-directed graph visualization of entities and their relationships, with enhanced visual encoding and interaction capabilities.

#### Scenario: Node sizing based on importance
- **WHEN** the graph is rendered
- **THEN** node size SHALL reflect the entity's mention count across all notes
- **AND** more frequently mentioned entities SHALL have larger nodes

#### Scenario: Relationship labels on edges
- **WHEN** the graph is rendered
- **THEN** each edge SHALL display the relationship type as a label (e.g., "投资", "收购", "合作")
- **AND** labels SHALL be readable at appropriate zoom levels

#### Scenario: Enhanced hover interactions
- **WHEN** the user hovers over a node
- **THEN** the system SHALL highlight the node and all its connected neighbors
- **AND** dim unrelated nodes for better focus

#### Scenario: Entity type color coding
- **WHEN** the graph is rendered
- **THEN** nodes SHALL be colored by entity type:
  - PERSON: blue
  - ORG: orange
  - GPE (location): green
  - EVENT: red
  - TECH: purple
  - WORK_OF_ART: pink

### Requirement: User-scoped graph data and privacy
The system SHALL scope all knowledge graph operations (extraction, querying, visualization) to the authenticated user's data.

#### Scenario: Prevent cross-user entity access
- **WHEN** the user attempts to view or query entities
- **THEN** the system SHALL only return entities where `user_id` matches the authenticated user
- **AND** deny access to entities owned by other users

#### Scenario: Prevent cross-user relationship access
- **WHEN** the user attempts to view relationships or evidence
- **THEN** the system SHALL only return relationships where `user_id` matches the authenticated user
- **AND** ensure all evidence sources are user-owned notes
