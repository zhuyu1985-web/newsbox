## ADDED Requirements

### Requirement: User registration
The system SHALL allow new users to create an account.

#### Scenario: Register with email and password
- **WHEN** a user submits valid email and password on the registration page
- **THEN** the system creates a new user account and redirects to the main dashboard

#### Scenario: Registration rejects invalid email
- **WHEN** a user submits an invalid email format
- **THEN** the system rejects the registration and indicates the email is invalid

#### Scenario: Registration enforces password requirements
- **WHEN** a user submits a password that does not meet requirements (e.g., too short)
- **THEN** the system rejects the registration and indicates password requirements

### Requirement: User login
The system SHALL allow registered users to authenticate and access the system.

#### Scenario: Login with valid credentials
- **WHEN** a user submits valid email and password on the login page
- **THEN** the system authenticates the user and redirects to the main dashboard

#### Scenario: Login rejects invalid credentials
- **WHEN** a user submits incorrect email or password
- **THEN** the system rejects the login and indicates invalid credentials

### Requirement: Session management
The system SHALL maintain user sessions and handle authentication state.

#### Scenario: Authenticated access to protected pages
- **WHEN** an authenticated user accesses a protected page
- **THEN** the system allows access and displays user-specific content

#### Scenario: Unauthenticated redirect
- **WHEN** an unauthenticated user attempts to access a protected page
- **THEN** the system redirects to the login page

#### Scenario: Logout
- **WHEN** an authenticated user clicks logout
- **THEN** the system ends the session and redirects to the landing page or login page

### Requirement: Post-authentication navigation
The system SHALL redirect authenticated users to the main dashboard after successful login or registration.

#### Scenario: Redirect after login
- **WHEN** a user successfully logs in
- **THEN** the system redirects to the main dashboard showing the user's collected notes

#### Scenario: Redirect after registration
- **WHEN** a user successfully registers
- **THEN** the system redirects to the main dashboard (may show empty state or onboarding)

