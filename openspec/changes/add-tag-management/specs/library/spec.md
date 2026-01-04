# Spec Delta: library

## MODIFIED Requirements

### Requirement: Custom tags for classification
The system SHALL allow a user to create, assign, and remove custom tags on notes/items, **and organize tags into hierarchical structures with multi-level nesting**.

#### Scenario: Create a custom tag
- **WHEN** the user creates a new custom tag with a name **in the tag management page or from the collections view**
- **THEN** the system creates the tag **as a root tag (no parent) unless a parent is specified** and makes it available for assignment to notes/items

#### Scenario: Create a child tag
- **WHEN** the user creates a new tag from a parent tag's context menu or specifies a parent during creation
- **THEN** the system creates the tag with the specified `parent_id`, displays it nested under the parent in the tag tree, and enforces name uniqueness only within that parent's children

#### Scenario: Add a custom tag to an item
- **WHEN** the user adds a custom tag to a note/item
- **THEN** the system associates the tag with the note/item and displays it in the UI

#### Scenario: Filter by custom tag
- **WHEN** the user filters the dashboard or library by a custom tag **in the collections view or selects a tag in the tag management page**
- **THEN** the system lists only notes/items associated with that tag **and optionally includes notes tagged with child tags if the user has enabled that preference**

#### Scenario: Filter by tag hierarchy
- **WHEN** the user selects a parent tag that has child tags in the tag management page
- **THEN** the system provides a toggle to include or exclude notes from child tags, and filters the note list accordingly based on the toggle state

#### Scenario: Remove a custom tag
- **WHEN** the user removes a tag from a note/item
- **THEN** the system disassociates the tag and updates the UI accordingly

## ADDED Requirements

### Requirement: Tag hierarchy and organization
The system SHALL support multi-level tag nesting, allowing users to organize tags into parent-child relationships with unlimited depth (though practical UI limits may apply).

#### Scenario: View tag hierarchy
- **WHEN** the user opens the tag management page
- **THEN** the system displays all tags in a tree structure with proper indentation, expand/collapse controls for parent tags, and note counts for each tag

#### Scenario: Expand and collapse tag tree
- **WHEN** the user clicks the expand/collapse chevron next to a parent tag
- **THEN** the system toggles the visibility of that tag's children and persists the expanded state during the session

#### Scenario: Move tag to different parent
- **WHEN** the user changes a tag's parent via edit dialog or drag-and-drop
- **THEN** the system validates there is no circular reference (tag cannot be moved to its own descendant), updates the `parent_id`, and re-renders the tree with the tag in its new location

#### Scenario: Prevent circular references
- **WHEN** the user attempts to move a tag to one of its own descendants (creating a circular reference)
- **THEN** the system blocks the operation and displays an error message: "无法将标签移动到其子标签下"

### Requirement: Tag CRUD operations
The system SHALL provide full create, read, update, and delete operations for tags with appropriate validation and user feedback.

#### Scenario: Rename tag
- **WHEN** the user selects "重命名" from a tag's context menu, enters a new name, and saves
- **THEN** the system validates the new name is unique under the same parent, updates the tag, and refreshes the tag tree

#### Scenario: Change tag icon and color
- **WHEN** the user selects "更换图标/颜色" from a tag's context menu, picks a new icon/color, and saves
- **THEN** the system updates the tag's `icon` and `color` fields and immediately reflects the changes in the UI

#### Scenario: Archive tag
- **WHEN** the user selects "归档" from a tag's context menu
- **THEN** the system sets `archived_at` to the current timestamp, hides the tag (and optionally its children) from default views, but preserves all tag-note associations

#### Scenario: Delete tag with validation
- **WHEN** the user selects "删除" from a tag's context menu
- **THEN** the system checks if the tag has children or associated notes; if yes, blocks deletion and shows a warning; if no, permanently deletes the tag after confirmation

#### Scenario: Force delete tag with notes
- **WHEN** the user confirms force deletion of a tag that has associated notes
- **THEN** the system removes all tag-note associations and deletes the tag, informing the user of the number of notes affected

### Requirement: Tag sorting and ordering
The system SHALL support custom ordering via drag-and-drop and alphabetical sorting by name.

#### Scenario: Custom sort order (default)
- **WHEN** the user views the tag list with "自定义排序" mode selected
- **THEN** the system displays tags ordered by their `position` field (ascending) at each level of the hierarchy

#### Scenario: Sort tags alphabetically A-Z
- **WHEN** the user selects "按名称 A-Z" from the sort dropdown
- **THEN** the system re-sorts all tags (and their children recursively) by name in ascending order, ignoring the `position` field

#### Scenario: Sort tags alphabetically Z-A
- **WHEN** the user selects "按名称 Z-A" from the sort dropdown
- **THEN** the system re-sorts all tags (and their children recursively) by name in descending order, ignoring the `position` field

#### Scenario: Drag-and-drop reorder within same level
- **WHEN** the user drags a tag and drops it between two sibling tags at the same level
- **THEN** the system calculates the new `position`, updates the tag and affected siblings via the reorder API, and persists the new order

#### Scenario: Drag-and-drop move to different parent
- **WHEN** the user drags a tag and drops it onto a different parent tag
- **THEN** the system validates no circular reference, updates the tag's `parent_id` and `position`, and moves the tag (with all its children) to the new parent in the tree

#### Scenario: Persist sort preference
- **WHEN** the user changes the sort mode
- **THEN** the system saves the preference to `localStorage` and applies it automatically on subsequent page loads

### Requirement: Tag-based note filtering in main content area
The system SHALL display notes associated with a selected tag in the main content area, reusing existing note list components and supporting all filtering, sorting, and view modes.

#### Scenario: Select tag to filter notes
- **WHEN** the user clicks a tag in the tag management sidebar
- **THEN** the system fetches all notes associated with that tag (and optionally child tags), displays them in the main content area using the current view mode, and highlights the selected tag in the sidebar

#### Scenario: No tag selected state
- **WHEN** the user is on the tag management page but has not selected any tag
- **THEN** the system displays a prompt message: "选择标签以查看笔记" in the main content area

#### Scenario: Toggle include child tags
- **WHEN** the user toggles the "包含子标签" option in the main content area toolbar
- **THEN** the system re-fetches notes, including or excluding notes from descendant tags based on the toggle state, and updates the note list

#### Scenario: Apply existing filters and sorts in tag view
- **WHEN** the user applies archived filter, content type filter, sort order, or view mode while viewing tag-filtered notes
- **THEN** the system applies all filters/sorts to the tag-filtered note set, just as it would in the collections view

#### Scenario: Perform note actions in tag view
- **WHEN** the user performs any note action (star, move, archive, delete, bulk actions) in the tag view
- **THEN** the system executes the action identically to the collections view, and updates the note list and tag note counts accordingly

### Requirement: Tag management page navigation
The system SHALL provide a dedicated "标签管理" (Tag Management) primary navigation item that switches the dashboard to tag management mode.

#### Scenario: Access tag management page
- **WHEN** the user clicks the "标签" icon in the primary navigation
- **THEN** the system switches to tag management mode, displays the tag hierarchy in the secondary navigation, and shows the main content area for tag-filtered notes (or a prompt if no tag is selected)

#### Scenario: Tag management persists across sessions
- **WHEN** the user navigates to tag management and then refreshes the page or returns later
- **THEN** the system remembers the last selected primary navigation item (tags) and restores the tag management view with the previously selected tag (if any)

#### Scenario: Switch from tag management to other views
- **WHEN** the user switches from tag management to another primary navigation item (e.g., collections, annotations, archive)
- **THEN** the system updates the secondary navigation and main content area to match the selected primary navigation context, clearing tag selection state

