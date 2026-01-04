## ADDED Requirements

### Requirement: Settings Center navigation & layout
The system SHALL provide a Settings Center page with a left navigation menu and a right content area, accessible from the dashboard.

#### Scenario: Open settings from dashboard
- **WHEN** the user clicks the Settings entry in the dashboard
- **THEN** the system navigates to the Settings Center and shows the left settings menu

#### Scenario: Switch settings sections
- **WHEN** the user clicks a section in the left menu (e.g., “我的账户”、“会员奖励”)
- **THEN** the right content area updates to show the selected section

### Requirement: Account center & security management
The system SHALL allow users to view and manage account information, including password updates and account bindings (email/phone/wechat), and provide a clear sign-out / switch-account entry.

#### Scenario: Update password
- **WHEN** the user submits a new password in Settings Center
- **THEN** the system updates the password and confirms success (or shows an actionable error)

#### Scenario: Sign out / switch account
- **WHEN** the user clicks “退出登录” or “切换账号”
- **THEN** the system ends the session and routes to the login page

### Requirement: Membership rewards via referral codes
The system SHALL support membership rewards with referral codes: one-time redemption for 7 days, and invitation rewards where both inviter and invitee receive 7 days up to a maximum of 49 days.

#### Scenario: Redeem referral code once
- **WHEN** the user inputs a valid referral code for the first time
- **THEN** the system grants 7 days membership and records the redemption to prevent reuse

#### Scenario: Invite reward cap enforcement
- **WHEN** an inviter has already reached the 49-day reward cap
- **THEN** the system blocks further reward grants and displays a clear explanation

### Requirement: Usage statistics dashboard
The system SHALL display usage statistics including days since signup, counts of notes/folders/smart-lists/tags/annotations, total words, total visits, and provide content-type distribution charts and top-10 site rankings.

#### Scenario: View basic usage stats
- **WHEN** the user opens “用量统计”
- **THEN** the system displays the defined metrics with consistent time-range/definition labels

#### Scenario: View charts and top sites
- **WHEN** the user views the statistics page
- **THEN** the system shows at least one distribution chart (pie or bar) and top-10 rankings for sources

### Requirement: Appearance theme and custom fonts
The system SHALL allow users to configure theme mode (system/light/dark) and import a custom font for the reader experience.

#### Scenario: Change theme
- **WHEN** the user switches theme mode in settings
- **THEN** the UI updates immediately and persists the preference

#### Scenario: Import a font
- **WHEN** the user uploads a supported font file and confirms
- **THEN** the font becomes selectable and can be applied to the reader

### Requirement: Recently deleted items (Recycle Bin)
The system SHALL provide a “最近删除” section that lists deleted items and allows restore or permanent deletion within a retention window.

#### Scenario: Restore a deleted item
- **WHEN** the user selects an item in “最近删除” and clicks restore
- **THEN** the system restores the item and removes it from the deleted list

#### Scenario: Permanently delete an item
- **WHEN** the user confirms permanent deletion
- **THEN** the system permanently removes the item and cannot restore it

### Requirement: About NewsBox & support links
The system SHALL provide an “关于 NewsBox” section with product info and support contact links including guide, docs, feedback, and contact details.

#### Scenario: Open support links
- **WHEN** the user clicks a support link entry
- **THEN** the system opens the target page or copies the contact info as appropriate


