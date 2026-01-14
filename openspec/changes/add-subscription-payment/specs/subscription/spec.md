## ADDED Requirements

### Requirement: Membership tiers
The system SHALL support three membership tiers: Trial (14 days free with full features), Pro (¥9.9/year with basic features), and AI (¥19.9/year with all features including AI capabilities).

#### Scenario: New user starts trial
- **WHEN** a new user registers an account
- **THEN** the system grants a 14-day trial with full Pro + AI access
- **AND** records the trial start date for expiration calculation

#### Scenario: Trial period provides full access
- **WHEN** a user is within the 14-day trial period
- **THEN** the user can access all Pro and AI features without payment

#### Scenario: Pro membership grants basic access
- **WHEN** a user has an active Pro membership
- **THEN** the user can access unlimited bookmarks, folders, tags, and ad-free reading
- **AND** the user cannot access AI features

#### Scenario: AI membership grants full access
- **WHEN** a user has an active AI membership
- **THEN** the user can access all Pro features plus AI capabilities
- **AND** AI features include: AI summary, AI snapshot, knowledge graph, smart topics, and AI quote extraction

### Requirement: Membership status calculation
The system SHALL calculate membership status in real-time based on plan type and expiration date.

#### Scenario: Active membership check
- **WHEN** the system checks a user's membership status
- **THEN** the system returns whether the membership is active (not expired)
- **AND** returns which features the user can access (Pro/AI)
- **AND** returns the days remaining until expiration

#### Scenario: Expired membership detection
- **WHEN** a user's membership expires_at is in the past
- **THEN** the system marks the membership as expired
- **AND** revokes access to protected features

### Requirement: AI feature access control
The system SHALL restrict AI features to users with AI membership or active trial.

#### Scenario: AI membership required for AI features
- **WHEN** a Pro user attempts to use an AI feature
- **THEN** the system blocks access and shows upgrade prompt
- **AND** provides a link to the pricing page

#### Scenario: AI features list
- **WHEN** checking AI feature access
- **THEN** the following features require AI membership:
  - AI article summary and analysis
  - AI snapshot generation
  - Knowledge graph
  - Smart topics clustering
  - AI quote extraction

### Requirement: Membership expiration notification
The system SHALL notify users before their membership expires and when it has expired.

#### Scenario: 7-day expiration warning
- **WHEN** a user's membership will expire in 7 days
- **THEN** the system sends a notification: "您的会员将在 7 天后到期，请及时续费以免影响使用"

#### Scenario: 3-day expiration warning
- **WHEN** a user's membership will expire in 3 days
- **THEN** the system sends a notification: "您的会员将在 3 天后到期，请及时续费以免影响使用"

#### Scenario: Expiration notification deduplication
- **WHEN** a notification for a specific expiration threshold has already been sent
- **THEN** the system does not send duplicate notifications

### Requirement: Membership extension
The system SHALL extend membership duration when a user makes a new payment.

#### Scenario: Extend from active membership
- **WHEN** an active member purchases a new subscription
- **THEN** the new period is added to the existing expiration date
- **AND** the plan type is updated if upgrading (Pro → AI)

#### Scenario: Reactivate expired membership
- **WHEN** an expired member purchases a new subscription
- **THEN** the new period starts from the current date
- **AND** the membership is immediately reactivated
