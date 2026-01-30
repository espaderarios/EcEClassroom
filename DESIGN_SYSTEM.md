# EClassroom Design System

## Overview
EClassroom now features a modern, comprehensive design system built with accessibility and user experience as core principles.

## Color Palette

### Primary Colors
- **Primary Blue**: `#3b82f6` - Main brand color for primary actions
- **Primary Light**: `#60a5fa` - Hover state and secondary highlights
- **Primary Dark**: `#1e40af` - Active/pressed state
- **Primary Darker**: `#1e3a8a` - Deep interactions

### Semantic Colors
- **Success (Emerald)**: `#10b981` - Positive actions, confirmations
- **Error (Red)**: `#ef4444` - Destructive actions, errors
- **Warning (Amber)**: `#f59e0b` - Cautions, alerts
- **Info (Blue)**: `#3b82f6` - Informational messages

### Neutral Colors
- **Background**: `#f8fafc` - Main background
- **Surface**: `#f1f5f9` - Secondary background
- **Card**: `#ffffff` - Card/container background
- **Text**: `#0f172a` - Primary text color
- **Text Muted**: `#64748b` - Secondary/disabled text
- **Border**: `#e2e8f0` - Border color

### Dark Mode
All colors automatically adjust when dark mode is enabled:
- Dark backgrounds are darker
- Light text becomes lighter
- Borders gain more opacity for visibility

## Typography

### Font Family
- **Primary**: Inter - Clean, modern sans-serif
- **Fallback**: System UI fonts

### Font Weights
- **Light**: 300 - Subtle text
- **Normal**: 400 - Body text
- **Medium**: 500 - Semi-important text
- **Semibold**: 600 - Headings, important labels
- **Bold**: 700 - Strong headings
- **Extrabold**: 800 - Display text

### Font Sizes
- **XS**: 12px - Small labels
- **SM**: 14px - Secondary text
- **Base**: 16px - Default body text
- **LG**: 18px - Subheadings
- **XL**: 20px - Medium headings
- **2XL**: 24px - Large headings
- **3XL**: 30px - Extra large headings
- **4XL**: 36px - Display text

### Line Heights
- **Tight**: 1.25 - Headings
- **Normal**: 1.5 - Body text
- **Relaxed**: 1.75 - For readability
- **Loose**: 2 - For lists

## Spacing System

Consistent spacing throughout the app:
- **XS**: 4px
- **SM**: 8px
- **MD**: 12px
- **LG**: 16px
- **XL**: 24px
- **2XL**: 32px
- **3XL**: 48px
- **4XL**: 64px

## Border & Radius

### Border Radius
- **SM**: 4px - Small elements
- **MD**: 8px - Standard elements
- **LG**: 12px - Cards, large buttons
- **XL**: 16px - Large cards
- **2XL**: 24px - Extra large elements
- **Full**: 9999px - Fully rounded (pills)

### Shadows
- **None**: No shadow
- **SM**: Subtle shadow
- **MD**: Medium elevation
- **LG**: Strong elevation
- **XL**: High elevation (modals)
- **2XL**: Highest elevation

## Components

### Buttons

#### Primary Button
```html
<button class="btn-primary">Save</button>
```
- Uses primary blue gradient
- White text
- Elevated shadow
- Hover: Lighter gradient, bigger shadow

#### Secondary Button
```html
<button class="btn-secondary">Cancel</button>
```
- Surface background with border
- Dark text
- Minimal elevation
- Hover: Darker surface

#### Success Button
```html
<button class="btn-success">Confirm</button>
```
- Green gradient
- Used for positive actions

#### Danger Button
```html
<button class="btn-danger">Delete</button>
```
- Red gradient
- Used for destructive actions

#### Text Button
```html
<button class="btn-text">Learn More</button>
```
- Transparent background
- Primary colored text
- Minimal visual weight

#### Icon Button
```html
<button class="btn-icon">🎯</button>
```
- Square shape
- No text
- For icons or emojis

### Cards

```html
<div class="card">
  <div class="card-header">
    <h3>Title</h3>
  </div>
  <div class="card-body">
    Content here
  </div>
  <div class="card-footer">
    <button class="btn-primary">Action</button>
  </div>
</div>
```

Features:
- White background with subtle border
- Rounded corners
- Hover effect (lift up slightly)
- Padding and spacing built-in

### Forms

```html
<div class="form-group">
  <label>Field Label</label>
  <input type="text" placeholder="Enter value">
  <div class="form-help">Helper text</div>
</div>
```

- Large touch targets (44px minimum)
- Clear focus indicators
- Proper spacing

### Badges

```html
<span class="badge badge-primary">New</span>
<span class="badge badge-success">Active</span>
<span class="badge badge-danger">Urgent</span>
```

### Toast Notifications

```javascript
toast('✅ Profile saved successfully');
toast('❌ Error occurred', 'error');
toast('⚠️ Warning message', 'warning');
```

## Animations

### Built-in Animations
- **fadeIn**: Fade in effect
- **slideInUp**: Slide up from bottom
- **slideInDown**: Slide down from top
- **slideInLeft**: Slide in from left
- **slideInRight**: Slide in from right
- **scaleIn**: Scale in effect
- **spin**: Rotating animation

### Animation Durations
- **75ms**: Micro interactions
- **150ms**: Quick feedback
- **200ms**: Standard transitions
- **300ms**: Most animations
- **500ms**: Slower animations
- **700ms**: Loading spinners
- **1000ms**: Slow animations

### Easing Functions
- **Linear**: Constant speed
- **In**: Slow start, fast end
- **Out**: Fast start, slow end
- **In-Out**: Slow start and end

## Accessibility Features

### Keyboard Navigation
- All interactive elements are keyboard accessible
- Tab order follows visual flow
- Focus indicators are clearly visible (blue outline)

### Screen Readers
- Semantic HTML elements (`<header>`, `<nav>`, `<main>`, `<footer>`)
- ARIA labels where needed
- Proper heading hierarchy

### Color Contrast
- All text meets WCAG AA standards (4.5:1 for normal text)
- No information conveyed by color alone
- Focus indicators are always visible

### Reduced Motion
- Animations respect `prefers-reduced-motion`
- Critical animations still work
- No motion-dependent functionality

## Dark Mode

The app automatically supports dark mode based on:
1. User's system preference
2. User's saved preference (localStorage)
3. Manual toggle via the moon/sun icon in the header

### Implementation
- Use CSS variables that change based on `prefers-color-scheme`
- Classes: `.dark-mode` and `.light-mode` for manual control
- Smooth transition between modes

## Responsive Design

### Breakpoints
- **Mobile**: < 640px (default)
- **Tablet**: 640px - 1024px
- **Desktop**: 1024px+

### Mobile-First Approach
- Base styles for mobile
- `@media (min-width: 768px)` for tablets
- `@media (min-width: 1024px)` for desktops

### Responsive Utilities
- `.grid-cols-1` → `.grid-cols-2` on tablet → `.grid-cols-3` on desktop
- `md:hidden` - Hide on desktop
- `md:block` - Show only on desktop

## Utility Classes

### Display
- `.block`, `.inline-block`, `.inline`, `.flex`, `.grid`
- `.hidden` - Hide element

### Spacing
- `.p-sm`, `.p-md`, `.p-lg`, `.p-xl` - Padding
- `.m-sm`, `.m-md`, `.m-lg`, `.m-xl` - Margin
- `.gap-sm`, `.gap-md`, `.gap-lg` - Gap (flex/grid)

### Flexbox
- `.flex`, `.flex-col`, `.flex-row`
- `.flex-between` - Space between
- `.flex-center` - Center content

### Text
- `.text-primary`, `.text-secondary`, `.text-accent`
- `.text-left`, `.text-center`, `.text-right`
- `.text-xs`, `.text-sm`, `.text-lg`, `.text-xl`
- `.font-light`, `.font-normal`, `.font-bold`

### Shadows
- `.shadow-sm`, `.shadow`, `.shadow-md`, `.shadow-lg`, `.shadow-xl`

### Borders
- `.border`, `.border-t`, `.border-r`, `.border-b`, `.border-l`
- `.border-primary`, `.border-accent`

### Transitions
- `.transition-all` - All properties
- `.transition-colors` - Color transitions
- `.transition-transform` - Transform transitions

## Best Practices

### 1. Color Usage
- Use semantic colors (primary for actions, success for confirmations, etc.)
- Never convey information by color alone
- Maintain sufficient contrast

### 2. Typography
- Use proper heading hierarchy (h1 → h2 → h3)
- Keep line length between 45-75 characters
- Use proper font weights for emphasis

### 3. Spacing
- Use the spacing scale consistently
- Don't mix arbitrary spacing with the system
- Use `gap` in flex/grid instead of margins

### 4. Buttons
- Always provide text labels (unless icon is obvious)
- Minimum touch target: 44x44px
- Use appropriate button style for context

### 5. Forms
- Group related fields with proper spacing
- Always include labels
- Provide helpful error and help text
- Use proper input types (email, number, etc.)

### 6. Accessibility
- Always include alt text for images
- Use semantic HTML
- Test with keyboard navigation
- Ensure focus indicators are visible

### 7. Dark Mode
- Don't force light or dark mode
- Respect user preference
- Test both modes thoroughly
- Ensure sufficient contrast in both modes

## Usage Examples

### Card with Action
```html
<div class="card">
  <div class="card-header">
    <h3>My Card</h3>
  </div>
  <div class="card-body">
    <p>Card content goes here</p>
  </div>
  <div class="card-footer flex gap-lg">
    <button class="btn-primary">Save</button>
    <button class="btn-secondary">Cancel</button>
  </div>
</div>
```

### Responsive Grid
```html
<div class="grid grid-cols-3 md:grid-cols-2">
  <div class="card">Item 1</div>
  <div class="card">Item 2</div>
  <div class="card">Item 3</div>
</div>
```

### Form
```html
<form class="card">
  <div class="form-group">
    <label>Email</label>
    <input type="email" placeholder="your@email.com">
  </div>
  <div class="form-group">
    <label>Password</label>
    <input type="password" placeholder="Enter password">
  </div>
  <button class="btn-primary w-full">Login</button>
</form>
```

## Maintenance

### Adding New Colors
1. Add to `:root` CSS variables
2. Add dark mode variant if needed
3. Add utility classes (`.text-newcolor`, `.bg-newcolor`)
4. Update this documentation

### Adding New Components
1. Create component styles in `styles.css`
2. Use CSS variables for colors, spacing, etc.
3. Include hover/focus states
4. Make responsive
5. Ensure accessibility
6. Document in this file

### Testing
- Visual testing in light and dark modes
- Keyboard navigation
- Screen reader testing
- Mobile responsiveness
- Color contrast verification

---

**Last Updated**: January 2026
**Version**: 2.0 (Modern Design System)
