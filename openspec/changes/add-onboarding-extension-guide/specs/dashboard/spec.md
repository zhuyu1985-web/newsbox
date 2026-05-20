# Spec Delta: dashboard

## ADDED Requirements
### Requirement: First-login product onboarding
The system SHALL provide a concise, skippable product onboarding guide when an authenticated user first opens the dashboard.

#### Scenario: Show onboarding to a new dashboard user
- **WHEN** an authenticated user opens the dashboard and has not completed or skipped onboarding in the current browser
- **THEN** the system displays a lightweight onboarding overlay explaining the core workflow
- **AND** the overlay includes steps for adding content, installing the browser extension, using AI reading features, and organizing saved content

#### Scenario: Persist onboarding completion locally
- **WHEN** the user completes or skips the onboarding guide
- **THEN** the system stores the completion state locally in the browser
- **AND** the guide does not automatically reopen on the next dashboard visit in that browser

### Requirement: Browser extension dashboard entry
The system SHALL provide a visible dashboard entry that lets users open browser extension installation instructions.

#### Scenario: Open extension guide from dashboard
- **WHEN** the user clicks the browser extension entry in the dashboard
- **THEN** the system navigates to the browser extension installation guide page
