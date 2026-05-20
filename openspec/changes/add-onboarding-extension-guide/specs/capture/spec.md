# Spec Delta: capture

## ADDED Requirements
### Requirement: Browser extension installation guide
The system SHALL provide a browser extension installation guide page that explains how to download and install the extension across supported browsers.

#### Scenario: View browser-specific installation instructions
- **WHEN** a user opens the browser extension guide page
- **THEN** the system displays installation instructions for Chrome, Edge, Firefox, and Safari
- **AND** the page explains the extension's role in saving web pages, collecting videos, and handling browser-side fallback capture

#### Scenario: Download packaged extension artifacts
- **WHEN** a packaged browser extension artifact is available for a supported browser
- **THEN** the system provides a download action for that browser-specific package
- **AND** unavailable packages are presented with a clear planning or preparation message instead of a broken link
