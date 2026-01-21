# EcEClassroom Modern Design - Quick Start Guide

## 🚀 Getting Started with the New Design System

This guide shows you how to use the modern design components and utilities in your code.

---

## 📦 Core Helper Functions

### createCard() - Modern Card Component

Create beautiful cards with optional header, body, and footer.

**Syntax**:
```javascript
createCard(content, { header, footer, elevated, className })
```

**Parameters**:
- `content` (string) - HTML content for the card body
- `header` (string, optional) - Header section HTML
- `footer` (string, optional) - Footer section HTML
- `elevated` (boolean, optional) - Add shadow for emphasis
- `className` (string, optional) - Additional CSS classes

**Examples**:

```javascript
// Simple card
createCard(`<p>Welcome to the app!</p>`)

// Card with header
createCard(`<p>This is the body content</p>`, {
  header: '<h2>Card Title</h2>'
})

// Card with footer and elevated style
createCard(`<p>User profile information</p>`, {
  header: '<h2>Profile</h2>',
  footer: '<button class="btn-primary">Edit</button>',
  elevated: true,
  className: 'mb-xl'
})

// In HTML template
${createCard(`
  <div class="space-y-lg">
    <p>Content here</p>
    <p>More content</p>
  </div>
`, {
  header: '<h2>Section</h2>',
  footer: createButton('Save', { onclick: 'save()' }),
  elevated: true
})}
```

---

### createButton() - Styled Buttons

Create buttons with different styles and variants.

**Syntax**:
```javascript
createButton(text, { onclick, variant, icon, className })
```

**Parameters**:
- `text` (string) - Button label
- `onclick` (string, optional) - JavaScript to execute on click
- `variant` (string, optional) - Style variant: 'primary', 'secondary', 'success', 'danger', 'text'
- `icon` (string, optional) - Emoji or icon to display
- `className` (string, optional) - Additional CSS classes

**Examples**:

```javascript
// Primary button
createButton('Save', { onclick: 'saveData()', icon: '💾' })

// Secondary button
createButton('Cancel', { variant: 'secondary', onclick: 'goBack()' })

// Success button
createButton('Confirm', { variant: 'success', icon: '✓' })

// Danger button
createButton('Delete', { variant: 'danger', icon: '🗑️' })

// Text button
createButton('Learn More', { variant: 'text', onclick: 'showInfo()' })

// Icon button
createButton('', { 
  variant: 'primary',
  icon: '🔔',
  className: 'btn-icon'
})
```

---

### createGrid() - Responsive Grids

Create responsive grid layouts.

**Syntax**:
```javascript
createGrid(items, { columns, gap })
```

**Parameters**:
- `items` (array) - Array of HTML strings
- `columns` (string, optional) - Grid columns class: 'grid-cols-1', 'grid-cols-2', 'grid-cols-3'
- `gap` (string, optional) - Gap size: 'gap-sm', 'gap-md', 'gap-lg', 'gap-xl'

**Examples**:

```javascript
// 3-column responsive grid
const cards = [
  createCard('<p>Card 1</p>'),
  createCard('<p>Card 2</p>'),
  createCard('<p>Card 3</p>')
];
createGrid(cards, { columns: 'grid-cols-3', gap: 'gap-lg' })

// 2-column grid
createGrid(
  [item1, item2, item3, item4],
  { columns: 'grid-cols-2', gap: 'gap-md' }
)
```

---

### createSection() - Content Sections

Create sections with title and content.

**Syntax**:
```javascript
createSection(title, content, { subtitle })
```

**Parameters**:
- `title` (string) - Section heading
- `content` (string) - Section HTML content
- `subtitle` (string, optional) - Subheading text

**Examples**:

```javascript
createSection(
  'Settings',
  `<label>Theme: <select><option>Light</option><option>Dark</option></select></label>`,
  { subtitle: 'Customize your experience' }
)
```

---

## 🎨 Button Styles

### Using HTML Button Classes

```html
<!-- Primary Button (Blue) -->
<button class="btn-primary">Save Changes</button>

<!-- Secondary Button (Gray) -->
<button class="btn-secondary">Cancel</button>

<!-- Success Button (Green) -->
<button class="btn-success">Confirm</button>

<!-- Danger Button (Red) -->
<button class="btn-danger">Delete</button>

<!-- Text Button (Minimal) -->
<button class="btn-text">Learn More</button>

<!-- Icon Button -->
<button class="btn-icon">🎯</button>
```

### Button States

```html
<!-- Disabled -->
<button class="btn-primary" disabled>Disabled</button>

<!-- Full Width -->
<button class="btn-primary w-full">Full Width Button</button>

<!-- With Icon -->
<button class="btn-primary">
  💾 Save
</button>
```

---

## 📝 Form Elements

### Form Groups

```html
<div class="form-group">
  <label for="email">Email Address</label>
  <input id="email" type="email" placeholder="your@email.com">
  <div class="form-help">We'll never share your email</div>
</div>

<div class="form-group">
  <label for="message">Message</label>
  <textarea id="message" placeholder="Enter your message"></textarea>
</div>

<div class="form-group">
  <label for="category">Category</label>
  <select id="category">
    <option>Select a category</option>
    <option>Option 1</option>
    <option>Option 2</option>
  </select>
</div>
```

### Form Validation

```html
<div class="form-group">
  <label for="username">Username</label>
  <input id="username" type="text">
  <div class="form-error">Username is required</div>
</div>
```

---

## 🎯 Utility Classes

### Layout Classes

```html
<!-- Flexbox -->
<div class="flex gap-lg">
  <div>Item 1</div>
  <div>Item 2</div>
</div>

<!-- Flex Between -->
<div class="flex-between gap-lg">
  <h2>Title</h2>
  <button>Action</button>
</div>

<!-- Flex Center -->
<div class="flex-center gap-md">
  <span>🎓</span>
  <h1>EcEClassroom</h1>
</div>

<!-- Grid -->
<div class="grid grid-cols-3 gap-lg">
  <div>Column 1</div>
  <div>Column 2</div>
  <div>Column 3</div>
</div>

<!-- Responsive Grid -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
  <div>Responsive</div>
</div>
```

### Spacing Classes

```html
<!-- Padding -->
<div class="p-sm">Small padding</div>
<div class="p-md">Medium padding</div>
<div class="p-lg">Large padding</div>
<div class="p-xl">Extra large padding</div>

<!-- Margin -->
<div class="m-lg">Large margin</div>
<div class="m-xl">Extra large margin</div>

<!-- Gap (in flex/grid) -->
<div class="flex gap-sm">Small gap</div>
<div class="flex gap-lg">Large gap</div>
```

### Text Classes

```html
<!-- Colors -->
<p class="text-primary">Primary color</p>
<p class="text-accent">Accent color</p>
<p class="text-muted">Muted text</p>
<p class="text-success">Success color</p>
<p class="text-error">Error color</p>

<!-- Sizes -->
<p class="text-xs">Extra small</p>
<p class="text-sm">Small</p>
<p class="text-lg">Large</p>
<p class="text-xl">Extra large</p>
<p class="text-2xl">2X Large</p>
<p class="text-3xl">3X Large</p>

<!-- Weight -->
<p class="font-light">Light weight</p>
<p class="font-normal">Normal weight</p>
<p class="font-semibold">Semibold weight</p>
<p class="font-bold">Bold weight</p>

<!-- Alignment -->
<p class="text-left">Left aligned</p>
<p class="text-center">Center aligned</p>
<p class="text-right">Right aligned</p>
```

### Shadow Classes

```html
<!-- Shadow Levels -->
<div class="shadow-sm">Small shadow</div>
<div class="shadow">Normal shadow</div>
<div class="shadow-md">Medium shadow</div>
<div class="shadow-lg">Large shadow</div>
<div class="shadow-xl">Extra large shadow</div>
<div class="shadow-2xl">2X Large shadow</div>
```

### Display Classes

```html
<!-- Display -->
<div class="block">Block element</div>
<div class="inline-block">Inline block</div>
<div class="flex">Flex container</div>
<div class="grid">Grid container</div>

<!-- Visibility -->
<div class="hidden">Hidden element</div>
<div class="md:hidden">Hidden on tablet+</div>
<div class="md:block">Show on tablet+</div>

<!-- Width/Height -->
<div class="w-full">Full width</div>
<div class="h-full">Full height</div>
```

### Border Classes

```html
<!-- Borders -->
<div class="border">All borders</div>
<div class="border-t">Top border</div>
<div class="border-b">Bottom border</div>
<div class="border-l">Left border</div>
<div class="border-r">Right border</div>

<!-- Border Colors -->
<div class="border border-primary">Primary border</div>
<div class="border border-accent">Accent border</div>
```

### Animation Classes

```html
<!-- Entrance Animations -->
<div class="animate-fadeIn">Fade in</div>
<div class="animate-slideInUp">Slide in from bottom</div>
<div class="animate-slideInDown">Slide in from top</div>
<div class="animate-slideInLeft">Slide in from left</div>
<div class="animate-slideInRight">Slide in from right</div>
<div class="animate-scaleIn">Scale in</div>
<div class="animate-spin">Spinning animation</div>

<!-- Transitions -->
<div class="transition-all">Animate all properties</div>
<div class="transition-colors">Animate colors</div>
<div class="transition-transform">Animate transforms</div>
```

### Responsive Utilities

```html
<!-- Hide/Show Based on Screen Size -->
<div class="md:hidden">Visible on mobile, hidden on tablet+</div>
<div class="md:block">Hidden on mobile, visible on tablet+</div>
<div class="lg:hidden">Visible until desktop</div>
<div class="lg:block">Visible on desktop+</div>

<!-- Responsive Grids -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  <!-- 1 column on mobile, 2 on tablet, 3 on desktop -->
</div>
```

---

## 🎭 Badges and Pills

### Using Badges

```html
<span class="badge badge-primary">New</span>
<span class="badge badge-success">Active</span>
<span class="badge badge-danger">Urgent</span>
<span class="badge badge-warning">Pending</span>
```

---

## 📢 Toast Notifications

### Creating Toasts

```javascript
// Success notification
toast('✅ Profile saved successfully');

// Error notification
toast('❌ An error occurred', 'error');

// Warning notification
toast('⚠️ Warning message', 'warning');

// Info notification
toast('ℹ️ Information message', 'info');

// Custom duration (5 seconds)
toast('Action completed', 'success', 5000);
```

---

## 🌙 Dark Mode

### Using Dark Mode

The app automatically detects system preference for dark mode. Users can also toggle via the moon/sun button in the header.

The theme preference is saved in localStorage and persists across sessions.

### Testing Dark Mode

1. Click the moon/sun icon in the top-right header
2. Or toggle system dark mode settings

---

## 💡 Best Practices

### 1. Use the Helper Functions
```javascript
// ✅ Good
createCard(content, { header: 'Title', elevated: true })

// ❌ Avoid
return `<div>Raw HTML without styling</div>`
```

### 2. Maintain Spacing
```javascript
// ✅ Good - Uses spacing system
className: 'mb-xl gap-lg p-lg'

// ❌ Avoid - Arbitrary spacing
style="margin-bottom: 25px; padding: 18px;"
```

### 3. Use Semantic Classes
```javascript
// ✅ Good
<button class="btn-primary">Save</button>

// ❌ Avoid
<button style="background: #3b82f6; color: white;">Save</button>
```

### 4. Organize with Cards
```javascript
// ✅ Good - Logical grouping
createCard(relatedContent, { header: 'Section Title' })

// ❌ Avoid - Disorganized content
return `<p>Random content</p><p>More content</p>`
```

### 5. Responsive First
```javascript
// ✅ Good - Mobile-first, responsive
className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3'

// ❌ Avoid - Desktop-only
style="display: grid; grid-template-columns: repeat(3, 1fr);"
```

---

## 🔍 Component Examples

### Example: User Profile Card

```javascript
const profile = getStudentProfile();

createCard(`
  <div class="flex-between gap-lg">
    <div>
      <h2 class="text-2xl font-bold">${profile.name}</h2>
      <p class="text-muted mt-sm">📧 ${profile.email}</p>
    </div>
    <div class="text-4xl">👤</div>
  </div>
`, {
  header: '<h2>Profile</h2>',
  footer: createButton('Edit', { 
    onclick: 'editProfile()',
    variant: 'primary'
  }),
  className: 'mb-xl'
})
```

### Example: Quiz List

```javascript
const quizzes = getQuizzes();

const quizCards = quizzes.map(quiz => 
  createCard(`
    <h3 class="text-lg font-bold">${quiz.title}</h3>
    <p class="text-muted mt-md">
      📋 ${quiz.questions.length} questions
      ${quiz.timeLimit ? `• ⏱️ ${quiz.timeLimit} min` : ''}
    </p>
  `, {
    footer: createButton('Start Quiz', {
      onclick: `startQuiz('${quiz.id}')`,
      variant: 'primary',
      icon: '🚀'
    }),
    className: 'mb-lg'
  })
);

createGrid(quizCards, { columns: 'grid-cols-2', gap: 'gap-lg' })
```

### Example: Form Page

```javascript
createCard(`
  <div class="space-y-lg">
    <div class="form-group">
      <label>Name</label>
      <input type="text" placeholder="Full name">
    </div>
    
    <div class="form-group">
      <label>Email</label>
      <input type="email" placeholder="your@email.com">
    </div>
    
    <div class="form-group">
      <label>Year Level</label>
      <select>
        <option>Grade 9</option>
        <option>Grade 10</option>
      </select>
    </div>
  </div>
`, {
  header: '<h2>Student Profile</h2>',
  footer: `
    ${createButton('Save', { 
      onclick: 'save()',
      variant: 'primary',
      icon: '💾'
    })}
    ${createButton('Cancel', {
      onclick: 'cancel()',
      variant: 'secondary'
    })}
  `,
  className: 'max-w-2xl'
})
```

---

## 📚 Additional Resources

- **Design System Guide**: See `DESIGN_SYSTEM.md`
- **Modernization Details**: See `MODERNIZATION_COMPLETE.md`
- **CSS Variables**: Check `styles.css` (lines 1-100)
- **Component Styles**: Check `styles.css` (lines 650-1000)

---

## 🆘 Troubleshooting

### Buttons not styled?
- Ensure you're using class names: `btn-primary`, `btn-secondary`, etc.
- Check that `styles.css` is loaded

### Dark mode not working?
- Browser may need refresh
- Check localStorage for 'theme-mode' key
- Verify `dark-mode` class is on body element

### Responsive layout not adapting?
- Use proper responsive classes: `md:hidden`, `grid-cols-2`, etc.
- Check breakpoints: 768px (tablet), 1024px (desktop)
- Test with browser DevTools device emulation

### Spacing looks off?
- Use spacing utilities: `p-lg`, `m-xl`, `gap-md`
- Don't mix arbitrary styles with utility classes
- Refer to the 8-level spacing scale

---

## ✨ Tips & Tricks

### Create Consistent Layouts
Always use `createCard()` for grouped content - it ensures consistent styling.

### Responsive Grids
Use `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` for automatic responsive layout.

### Quick Animations
Add `animate-fadeIn` or `animate-slideInUp` class for automatic entrance animations.

### Toast Feedback
Always show a toast after user actions for clear feedback.

### Accessibility
- Use semantic HTML
- Include labels with form inputs
- Provide button text (even for icon buttons)
- Test with keyboard navigation

---

**Happy Coding! 🎉**

For questions or issues, refer to `DESIGN_SYSTEM.md` for comprehensive documentation.
