## MODIFIED Requirements

### Requirement: Session management
The system SHALL maintain user sessions and handle authentication state, including membership-based access control.

#### Scenario: Authenticated access to protected pages
- **WHEN** an authenticated user accesses a protected page
- **THEN** the system allows access and displays user-specific content

#### Scenario: Unauthenticated redirect
- **WHEN** an unauthenticated user attempts to access a protected page
- **THEN** the system redirects to the login page

#### Scenario: Logout
- **WHEN** an authenticated user clicks logout
- **THEN** the system ends the session and redirects to the landing page or login page

#### Scenario: Trial expired user login interception
- **WHEN** an authenticated user's trial period has expired AND they have no active subscription
- **THEN** the system redirects to /pricing with message "您的试用期已结束，请订阅后继续使用"
- **AND** prevents access to the dashboard until subscription is activated

#### Scenario: Membership expired user login interception
- **WHEN** an authenticated user's membership has expired
- **THEN** the system redirects to /pricing with message "您的会员已到期，请续费后继续使用"
- **AND** prevents access to the dashboard until subscription is renewed

#### Scenario: Active membership allows access
- **WHEN** an authenticated user has an active trial or paid subscription
- **THEN** the system allows access to the dashboard and appropriate features based on plan type

## ADDED Requirements

### Requirement: Trial initialization on registration
The system SHALL automatically initialize a 14-day trial period when a new user registers.

#### Scenario: New user trial setup
- **WHEN** a new user successfully completes registration
- **THEN** the system creates a user_memberships record with plan_type='trial'
- **AND** sets trial_started_at to the current timestamp
- **AND** the user can immediately access all features during the trial period

### Requirement: Membership status display in header
The system SHALL display the user's membership status in the application header.

#### Scenario: Show trial status
- **WHEN** a trial user is logged in
- **THEN** the header shows "试用中" badge with days remaining

#### Scenario: Show Pro status
- **WHEN** a Pro member is logged in
- **THEN** the header shows "Pro" badge

#### Scenario: Show AI status
- **WHEN** an AI member is logged in
- **THEN** the header shows "Pro + AI" badge

#### Scenario: Show expiring soon warning
- **WHEN** a user's membership expires within 7 days
- **THEN** the header shows an expiration warning indicator
