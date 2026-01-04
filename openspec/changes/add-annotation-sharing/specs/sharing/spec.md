## ADDED Requirements

### Requirement: Share individual annotations with password protection
The system SHALL allow users to create shareable links for specific annotations or groups of annotations with optional password protection and expiration.

#### Scenario: Create share link for single annotation
- **WHEN** the user clicks "Share" on an individual annotation in the reader sidebar
- **THEN** the system displays a share dialog allowing the user to configure password protection, expiration date, and generate a unique share URL

#### Scenario: Create share link for multiple annotations
- **WHEN** the user selects multiple annotations and clicks "Share Selected"
- **THEN** the system creates a single share link containing all selected annotations with unified access controls

#### Scenario: Password-protect shared annotation
- **WHEN** the user enables password protection when creating a share link
- **THEN** the system requires recipients to enter the password before viewing the shared annotations

#### Scenario: Set expiration date for share link
- **WHEN** the user sets an expiration date when creating a share link
- **THEN** the system blocks access to the share link after the expiration date/time and displays an expiration message

#### Scenario: Copy share link to clipboard
- **WHEN** the user clicks "Copy Link" after creating a share
- **THEN** the system copies the full share URL to clipboard and shows a success notification

### Requirement: View shared annotations without authentication
The system SHALL provide a public, unauthenticated view for accessing shared annotations via share links.

#### Scenario: Access valid share link without password
- **WHEN** a recipient visits a share link that does not have password protection and has not expired
- **THEN** the system displays the shared annotations with proper formatting, including quote text, user notes, screenshots, and source attribution

#### Scenario: Access password-protected share link
- **WHEN** a recipient visits a password-protected share link
- **THEN** the system displays a password entry form and only reveals the annotations after successful password verification

#### Scenario: Access expired share link
- **WHEN** a recipient visits an expired share link
- **THEN** the system displays a message indicating the share link has expired and does not reveal any annotation content

#### Scenario: Display source attribution in shared view
- **WHEN** shared annotations are displayed
- **THEN** the system includes the original article/video title, source URL, and creation date for proper citation

### Requirement: Manage shared annotation links
The system SHALL allow users to view, edit, and delete their created share links.

#### Scenario: List all created share links
- **WHEN** the user accesses share management interface
- **THEN** the system displays all active share links with metadata (creation date, expiration, access count, password status)

#### Scenario: Revoke share link
- **WHEN** the user deletes a share link
- **THEN** the system immediately invalidates the link and displays an "access denied" message to future visitors

#### Scenario: Update share link settings
- **WHEN** the user edits an existing share link
- **THEN** the system allows updating the password and expiration date without changing the share URL

### Requirement: Track share link access (optional analytics)
The system SHALL optionally track access events for shared annotation links without collecting personally identifiable information.

#### Scenario: Log anonymous access event
- **WHEN** a recipient successfully accesses a shared annotation link
- **THEN** the system records the access timestamp and approximate location (country/region only) without storing IP addresses or user agents

#### Scenario: Display access analytics to creator
- **WHEN** the share creator views a share link's details
- **THEN** the system displays total view count, last accessed time, and geographic distribution (if enabled)

## MODIFIED Requirements

### Requirement: Share highlight quotes
The system SHALL allow a user to share specific highlights as quote cards, formatted text, or shareable protected links.

#### Scenario: Share a highlight
- **WHEN** the user selects a highlight and chooses to share
- **THEN** the system offers multiple sharing options: (1) generate quote card text, (2) create password-protected link, or (3) copy formatted quote to clipboard

#### Scenario: Copy quote to clipboard
- **WHEN** the user copies a highlight quote
- **THEN** the system formats it as readable text (e.g., quote + source link) and copies to clipboard

#### Scenario: Share highlight as protected link
- **WHEN** the user creates a protected share link for a highlight
- **THEN** the system generates a shareable URL with optional password and expiration controls as defined in "Share individual annotations with password protection" requirement
