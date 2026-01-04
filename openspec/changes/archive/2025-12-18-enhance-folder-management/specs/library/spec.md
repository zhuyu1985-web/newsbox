## MODIFIED Requirements
### Requirement: Folders / collections (custom groups)
The system SHALL allow users to organize notes/items into hierarchical folders (“收藏夹”) with at least one level of nesting, surfaced inside the dashboard/library sidebar with a dedicated `+` creation entry.

#### Scenario: Create a root folder via "+"
- **WHEN** the user clicks the `+` button next to the “收藏夹” heading and submits a name (and optional icon)
- **THEN** the system creates a top-level folder owned by the user, appends it to the list, and makes it immediately selectable for organizing notes/items

#### Scenario: Create a subfolder from a parent folder
- **WHEN** the user opens the “...” menu beside an existing folder and chooses “创建子收藏夹”
- **THEN** the system prompts for the new folder’s name/icon, persists it with the parent folder’s ID, and displays it nested beneath that parent with proper indentation/expand state

#### Scenario: Move an item to a (nested) folder
- **WHEN** the user assigns a note/item to any folder (root or child) via move dialogs or drag/drop
- **THEN** the note/item appears under that folder in the library/dashboard, and folder counts update to reflect the change

#### Scenario: Filter by folder selection
- **WHEN** the user selects a folder anywhere in the hierarchy
- **THEN** the main list displays only notes/items belonging to that folder, highlights the selected node (and its ancestor chain), and keeps other filters (tags/smart lists) cleared

## ADDED Requirements
### Requirement: Folder management actions
Each folder SHALL expose a contextual “...” menu with management actions: rename, change icon, create child folder, archive, and delete (when safe).

#### Scenario: Rename or change icon
- **WHEN** the user chooses “重命名”或“更换图标” from a folder’s “...” menu and saves the dialog
- **THEN** the system updates the folder record (name/icon), refreshes the sidebar entry, and keeps existing child folders/items intact

#### Scenario: Archive a folder
- **WHEN** the user selects “归档” on a folder
- **THEN** the system marks it archived (and hides it plus its children from the default sidebar), without deleting contained notes/items; archived folders can be restored via future flows

#### Scenario: Delete a folder with validation
- **WHEN** the user chooses “删除” on a folder that has no child folders or notes
- **THEN** the system permanently removes the folder and confirms success; if the folder still contains content, the system blocks the deletion and informs the user to move/archive content first

