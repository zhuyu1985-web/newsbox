# ai-snapshots Specification (Delta)

## ADDED Requirements

### Requirement: Persist AI snapshot content and assets
The system SHALL persist AI snapshot content and its rendered image assets for each note.

#### Scenario: Persist snapshot content
- **WHEN** the user generates an AI snapshot for a note
- **THEN** the system stores structured snapshot data in the database
- **AND** stores rendered image files in object storage
- **AND** stores storage references (bucket/path) in the database

### Requirement: Avoid duplicate AI generation for the same content version
The system SHALL call the AI model only once per note content version, identified by a stable content fingerprint.

#### Scenario: Deduplicate concurrent generation
- **WHEN** multiple requests attempt to generate an AI snapshot for the same note content version
- **THEN** only one request performs AI generation
- **AND** all requests observe the same stored snapshot result

### Requirement: Query snapshot before generating
The system SHALL check for an existing snapshot before initiating generation.

#### Scenario: Cache hit on entering snapshot view
- **WHEN** the user opens the AI snapshot view for a note
- **THEN** the system queries the database for an existing snapshot for the current note content version
- **AND** if found, returns stored assets without calling the AI model

### Requirement: Style switching MUST NOT invoke AI
The system SHALL render or transform styles using stored snapshot data without invoking the AI model.

#### Scenario: Switch template uses persisted data
- **WHEN** the user switches snapshot template (e.g. business/deep/social)
- **THEN** the system renders or retrieves the template-specific asset based on persisted snapshot data
- **AND** does not call the AI model

### Requirement: Provide time-bound access links for stored assets
The system SHALL provide access links for stored snapshot assets suitable for client display.

#### Scenario: Signed URL for private bucket
- **WHEN** the client requests a stored snapshot asset
- **THEN** the system returns a time-bound signed URL to the asset
