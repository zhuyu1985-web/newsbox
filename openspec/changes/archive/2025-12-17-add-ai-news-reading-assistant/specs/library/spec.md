## ADDED Requirements

### Requirement: Library listing and retrieval
The system SHALL provide a library view that lists a user's notes/items and allows opening a single note/item for reading.

#### Scenario: List notes in the library
- **WHEN** the user opens the library
- **THEN** the system shows a list of notes/items ordered by a defined default (e.g., most recent first)

#### Scenario: Open a note
- **WHEN** the user selects a note/item from the list
- **THEN** the system displays the note/item detail including title, URL, and available content

### Requirement: Main dashboard displays all collected notes
The system SHALL display all collected notes/items in the main dashboard as the primary view after authentication.

#### Scenario: Dashboard shows all items
- **WHEN** the user views the main dashboard
- **THEN** the system displays all notes/items the user has collected, regardless of folder or tag assignment

#### Scenario: Dashboard is default view
- **WHEN** the user logs in or registers
- **THEN** the system redirects to the main dashboard showing all collected content

### Requirement: Folders / collections (custom groups)
The system SHALL allow a user to organize notes/items into folders/collections ("收藏夹") as custom groups.

#### Scenario: Create a custom group/folder
- **WHEN** the user creates a new folder/group with a custom name
- **THEN** the system creates the folder/group and it becomes selectable for organizing notes/items

#### Scenario: Move an item to a custom group
- **WHEN** the user assigns a note/item to a folder/group
- **THEN** the note/item appears under that folder/group in the library and dashboard

#### Scenario: Filter by custom group
- **WHEN** the user selects a custom group/folder in the dashboard or library
- **THEN** the system displays only notes/items belonging to that group

### Requirement: Custom tags for classification
The system SHALL allow a user to create, assign, and remove custom tags on notes/items.

#### Scenario: Create a custom tag
- **WHEN** the user creates a new custom tag with a name
- **THEN** the system creates the tag and makes it available for assignment to notes/items

#### Scenario: Add a custom tag to an item
- **WHEN** the user adds a custom tag to a note/item
- **THEN** the system associates the tag with the note/item and displays it in the UI

#### Scenario: Filter by custom tag
- **WHEN** the user filters the dashboard or library by a custom tag
- **THEN** the system lists only notes/items associated with that tag

#### Scenario: Remove a custom tag
- **WHEN** the user removes a tag from a note/item
- **THEN** the system disassociates the tag and updates the UI accordingly

### Requirement: Search across the library
The system SHALL allow a user to search notes/items by keyword across title and extracted content when available.

#### Scenario: Search returns matches
- **WHEN** the user searches for a keyword that exists in saved items
- **THEN** the system returns a list of matching notes/items

#### Scenario: Search handles missing extracted content
- **WHEN** the user searches and some items have no extracted content
- **THEN** the system still searches available fields (e.g., title/URL) and does not error

### Requirement: Reading status
The system SHALL support an item reading status to help users manage backlog (e.g., unread/archived).

#### Scenario: Mark item as archived
- **WHEN** the user marks a note/item as archived
- **THEN** the system updates the item's status and allows filtering it out from default views


