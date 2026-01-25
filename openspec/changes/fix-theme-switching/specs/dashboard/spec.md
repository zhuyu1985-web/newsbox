# dashboard Specification Delta

## MODIFIED Requirements

### Requirement: Main dashboard as default view

The system SHALL display the main dashboard as the default view after user authentication.

#### Scenario: Dashboard loads with theme switcher (NEW)
- **WHEN** a user successfully logs in or registers
- **THEN** the system displays the main dashboard
- **AND** the system displays a theme switcher button in the bottom action area

---

### Requirement: Dashboard content display

The system SHALL display collected notes/items in the dashboard with appropriate visual representation based on content type.

#### Scenario: Display cards in dark mode (NEW)
- **WHEN** the dashboard displays note cards in dark mode
- **THEN** the system shows dark card backgrounds (slate-900)
- **AND** the system shows light text for titles (slate-100)
- **AND** the system shows muted text for metadata (slate-400)

---

### Requirement: Dashboard navigation

The system SHALL provide navigation from the dashboard to detailed note/item views and other system features.

#### Scenario: Access theme switching from dashboard (NEW)
- **WHEN** a user wants to switch themes on the dashboard
- **THEN** the system provides a theme switcher button in the bottom action area
- **AND** the button displays an icon representing the current theme
- **AND** clicking the button opens a menu with theme options

---

## ADDED Requirements

### Requirement: Dashboard dark mode adaptation

The system SHALL adapt the dashboard interface to dark mode when the dark theme is active.

#### Scenario: Sidebar dark mode
- **WHEN** the dark theme is active on the dashboard
- **THEN** the system displays dark backgrounds for sidebars
- **AND** the system displays light text for navigation labels
- **AND** the system displays appropriate hover states

#### Scenario: Main content area dark mode
- **WHEN** the dark theme is active on the dashboard
- **THEN** the system displays a dark background for the main content area
- **AND** the system adapts all interactive elements to dark mode

#### Scenario: Note cards dark mode
- **WHEN** the dark theme is active on the dashboard
- **THEN** the system displays dark backgrounds for note cards
- **AND** the system displays light text for card content
- **AND** the system maintains visual hierarchy with appropriate contrast

#### Scenario: Action buttons dark mode
- **WHEN** the dark theme is active on the dashboard
- **THEN** the system adapts all action buttons to dark mode
- **AND** the system maintains button visibility and affordance

---

### Requirement: Theme switcher integration

The system SHALL integrate a theme switcher component into the dashboard interface.

#### Scenario: Compact theme switcher variant
- **WHEN** the theme switcher is displayed on the dashboard
- **THEN** the system uses the compact variant (w-[46px] h-[46px])
- **AND** the button style matches other dashboard action buttons

#### Scenario: Theme switcher placement
- **WHEN** the theme switcher is displayed on the dashboard
- **THEN** the system places it in the bottom action area
- **AND** the system positions it above other action buttons

---

### Requirement: Smart topics dark mode

The system SHALL adapt the smart topics interface to dark mode.

#### Scenario: Smart topics container dark mode
- **WHEN** the dark theme is active and the user views smart topics
- **THEN** the system displays a dark background for the main container
- **AND** the system adapts all UI elements to dark mode

#### Scenario: Topic cards dark mode
- **WHEN** the dark theme is active and topic cards are displayed
- **THEN** the system displays dark card backgrounds
- **AND** the system displays light text for topic titles
- **AND** the system adapts badges and tags to dark mode

#### Scenario: Stats cards dark mode
- **WHEN** the dark theme is active and stats cards are displayed
- **THEN** the system displays dark card backgrounds
- **AND** the system displays light text for statistics
- **AND** the system adapts icons to dark mode
