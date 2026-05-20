# Change: Add onboarding and browser extension guide

## Why
New users need a concise path from first login to useful product actions, especially saving content and understanding the browser extension workflow. The browser extension already has local build artifacts, but the application does not expose a clear download or installation path.

## What Changes
- Add a first-login dashboard onboarding overlay with a short, skippable guided flow.
- Add a persistent dashboard entry for browser extension installation.
- Add a public `/extension` installation guide page with browser-specific instructions.
- Add a local download API for existing extension zip artifacts.

## Impact
- Affected specs: `dashboard`, `capture`
- Affected code: dashboard UI, new onboarding component, extension guide page, extension download API route
