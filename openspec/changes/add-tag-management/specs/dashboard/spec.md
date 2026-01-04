# Spec Delta: dashboard

## ADDED Requirements

### Requirement: Tag management primary navigation
The system SHALL provide a "标签管理" (Tag Management) primary navigation item that displays a hierarchical tag organization interface in the secondary navigation and tag-filtered notes in the main content area.

#### Scenario: Access tag management page
- **WHEN** the user clicks the "标签" (Tags) icon in the primary navigation
- **THEN** the system switches to tag management mode, displays the tag hierarchy in the secondary navigation, and shows all notes (or prompts to select a tag) in the main content area

#### Scenario: Tag management persists across sessions
- **WHEN** the user navigates to tag management and then refreshes the page or returns later
- **THEN** the system remembers the last selected primary navigation item and restores the tag management view

#### Scenario: Switch between primary navigation items
- **WHEN** the user switches from tag management to another primary navigation item (e.g., collections, annotations, archive)
- **THEN** the system updates the secondary navigation and main content area to match the selected primary navigation context

## MODIFIED Requirements

### Requirement: Dashboard organization and filtering
The system SHALL allow users to organize and filter dashboard content using custom groups (folders), **hierarchical tags**, and other organizational features.

#### Scenario: Filter by custom tag
- **WHEN** the user selects a custom tag in the dashboard **or tag management page**
- **THEN** the system displays only notes/items associated with that tag **and optionally its child tags (based on user preference)**

#### Scenario: Filter by tag hierarchy
- **WHEN** the user selects a parent tag that has child tags
- **THEN** the system provides an option to include or exclude notes from child tags, and filters the note list accordingly

