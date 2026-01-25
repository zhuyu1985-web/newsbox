# theme-switching Specification

## Purpose

定义主题切换系统的功能需求，包括用户界面、主题模式、状态管理和样式适配。

## Requirements

### Requirement: Theme switcher component

The system SHALL provide a theme switcher component that allows users to switch between light, dark, and system themes.

#### Scenario: Display theme switcher on landing page
- **WHEN** a user views the landing page
- **THEN** the system displays a theme switcher button in the navigation bar

#### Scenario: Display theme switcher on dashboard
- **WHEN** a user views the dashboard
- **THEN** the system displays a theme switcher button in the bottom action area

#### Scenario: Show current theme in button
- **WHEN** the theme switcher button is displayed
- **THEN** the system shows an icon representing the current theme (sun for light, moon for dark, laptop for system)

#### Scenario: Open theme menu on click
- **WHEN** a user clicks the theme switcher button
- **THEN** the system displays a popover menu with three options: "浅色" (Light), "深色" (Dark), "自动" (System)

#### Scenario: Animated menu appearance
- **WHEN** the theme menu opens
- **THEN** the system displays a smooth animation with spring physics
- **AND** menu items appear sequentially with staggered delay

#### Scenario: Highlight active theme
- **WHEN** the theme menu is displayed
- **THEN** the system highlights the currently active theme with a background color

#### Scenario: Close menu on outside click
- **WHEN** a user clicks outside the theme menu
- **THEN** the system closes the menu

---

### Requirement: Theme switching functionality

The system SHALL allow users to switch between three theme modes: light, dark, and system.

#### Scenario: Switch to light theme
- **WHEN** a user selects "浅色" (Light) from the theme menu
- **THEN** the system applies light theme to the entire application
- **AND** the system saves "light" to localStorage
- **AND** the system removes the "dark" class from the HTML element

#### Scenario: Switch to dark theme
- **WHEN** a user selects "深色" (Dark) from the theme menu
- **THEN** the system applies dark theme to the entire application
- **AND** the system saves "dark" to localStorage
- **AND** the system adds the "dark" class to the HTML element

#### Scenario: Switch to system theme
- **WHEN** a user selects "自动" (System) from the theme menu
- **THEN** the system saves "system" to localStorage
- **AND** the system applies the OS theme preference (light or dark)
- **AND** the system updates when OS theme changes

#### Scenario: Close menu after selection
- **WHEN** a user selects a theme option
- **THEN** the system closes the theme menu
- **AND** the system applies the selected theme immediately

---

### Requirement: Dark mode visual adaptation

The system SHALL properly adapt all UI components to dark mode when the dark theme is active.

#### Scenario: Dashboard background in dark mode
- **WHEN** the dark theme is active and the user views the dashboard
- **THEN** the system displays a dark background (slate-950) instead of light background (slate-50)

#### Scenario: Dashboard sidebar in dark mode
- **WHEN** the dark theme is active and the user views the dashboard
- **THEN** the system displays dark backgrounds for sidebars (slate-900)
- **AND** the system displays light text for navigation items (slate-100/400)

#### Scenario: Dashboard cards in dark mode
- **WHEN** the dark theme is active and the user views note cards
- **THEN** the system displays dark card backgrounds (slate-900)
- **AND** the system displays light text for titles (slate-100)
- **AND** the system displays muted text for metadata (slate-400)

#### Scenario: Landing page in dark mode
- **WHEN** the dark theme is active and the user views the landing page
- **THEN** the system adapts all sections to dark mode
- **AND** the system maintains proper contrast for readability
- **AND** the system displays appropriate colors for interactive elements

#### Scenario: Settings page in dark mode
- **WHEN** the dark theme is active and the user views the settings page
- **THEN** the system displays dark backgrounds for settings cards
- **AND** the system displays light text for labels and descriptions
- **AND** the theme switcher buttons display correct active/inactive states

#### Scenario: Smart topics page in dark mode
- **WHEN** the dark theme is active and the user views the smart topics page
- **THEN** the system displays dark backgrounds for the main container
- **AND** the system displays light text for topic cards
- **AND** the system adapts all badges and tags to dark mode

---

### Requirement: Theme persistence

The system SHALL persist the user's theme preference across sessions.

#### Scenario: Save theme preference
- **WHEN** a user selects a theme (light/dark/system)
- **THEN** the system saves the theme value to localStorage

#### Scenario: Restore theme on page load
- **WHEN** a user returns to the application
- **THEN** the system loads the saved theme from localStorage
- **AND** the system applies the saved theme before rendering the page

#### Scenario: Default to system theme
- **WHEN** a user visits the application for the first time
- **THEN** the system defaults to "system" theme
- **AND** the system applies the OS theme preference

---

### Requirement: Visual consistency

The system SHALL maintain visual consistency across all pages when theme is switched.

#### Scenario: Consistent button styles
- **WHEN** the theme switches between light and dark
- **THEN** all buttons across all pages update their styles consistently

#### Scenario: Consistent card styles
- **WHEN** the theme switches between light and dark
- **THEN** all cards across all pages update their background and border colors consistently

#### Scenario: Consistent text colors
- **WHEN** the theme switches between light and dark
- **THEN** all text elements maintain proper contrast and readability

#### Scenario: Consistent border colors
- **WHEN** the theme switches between light and dark
- **THEN** all borders and dividers update to appropriate colors for the theme

---

### Requirement: Accessibility

The system SHALL ensure theme switching is accessible to all users.

#### Scenario: Keyboard navigation
- **WHEN** a user navigates using keyboard
- **THEN** the theme switcher button is focusable
- **AND** the menu can be opened with Enter/Space
- **AND** menu items can be selected with arrow keys
- **AND** the menu can be closed with Escape

#### Scenario: Screen reader support
- **WHEN** a user uses a screen reader
- **THEN** the theme switcher button has an accessible label
- **AND** the menu announces the current theme
- **AND** menu items are announced as radio buttons

#### Scenario: Sufficient color contrast
- **WHEN** the theme is light or dark
- **THEN** all text meets WCAG AA contrast requirements (4.5:1 for normal text)
- **AND** interactive elements meet contrast requirements (3:1)

---

### Requirement: Performance

The system SHALL ensure theme switching performs smoothly without jank or layout shifts.

#### Scenario: Smooth theme transition
- **WHEN** a user switches themes
- **THEN** the theme applies immediately without visual glitches
- **AND** there is no flash of incorrect colors

#### Scenario: No layout shift
- **WHEN** a user switches themes
- **THEN** the layout remains stable
- **AND** there is no content reflow

#### Scenario: Fast menu animation
- **WHEN** a user opens the theme menu
- **THEN** the animation completes within 300ms
- **AND** the frame rate stays at 60fps

---

### Requirement: Developer experience

The system SHALL provide a straightforward API for theme management.

#### Scenario: Use theme hook
- **WHEN** a developer needs to access the current theme
- **THEN** the system provides the `useTheme` hook from next-themes
- **AND** the hook returns `theme` (current value) and `setTheme` (update function)

#### Scenario: Apply dark mode styles
- **WHEN** a developer needs to add dark mode styles
- **THEN** the system uses Tailwind's `dark:` prefix convention
- **AND** styles automatically apply when `dark` class is present

#### Scenario: Theme-aware components
- **WHEN** a developer creates a component
- **THEN** the system allows using semantic color tokens
- **AND** the tokens automatically adapt to the current theme
