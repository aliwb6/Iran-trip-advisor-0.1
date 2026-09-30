# Typography System Documentation

## Overview
This project uses a **centralized typography system** with the **Khamenei** custom font as the primary typeface for all languages (English, Persian/Farsi, Arabic).

## Quick Start

### Changing the Font
To replace the font across the entire platform:

1. Replace font files in `/public/fonts/` with your new font files
2. Update the `@font-face` declarations in `src/index.css`
3. Update `--font-primary` variable in the `:root` section
4. Rebuild the application

### Font Files Location
```
/public/fonts/
├── Khamenei-Regular.ttf  (400 - Normal)
├── Khamenei-Medium.ttf   (500 - Medium)
├── Khamenei-Bold.ttf     (700 - Bold)
└── Khamenei-Black.ttf    (900 - Black)
```

## Typography Architecture

### CSS Variables (src/index.css)
```css
--font-primary: 'Khamenei', 'Tahoma', 'Arial', sans-serif;
--font-fallback-latin: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial;
--font-fallback-arabic: 'Tahoma', 'Arial', 'Noto Sans Arabic';
--font-fallback-system: system-ui, -apple-system, sans-serif;
```

### Tailwind Integration (tailwind.config.js)
```js
fontFamily: {
  primary: ['var(--font-primary)', 'var(--font-fallback-system)'],
  sans: ['var(--font-primary)', 'var(--font-fallback-system)'],
  // ... other utilities
}
```

## Font Usage Guidelines

### Automatic Global Application
The font is automatically applied to:
- Body text
- Headings (h1-h6)
- Navigation
- Form elements (inputs, buttons, labels)
- Cards and modals
- Admin panel
- Chatbot UI

### Manual Usage (if needed)
```jsx
// React/JSX
<div className="font-primary">
  Text with Khamenei font
</div>

// Or use Tailwind utilities
<p className="font-sans">
  Body text
</p>

<h1 className="font-bold">
  Heading
</h1>
```

## Typography Scale

| Element | Weight | Size | Line Height |
|---------|--------|------|-------------|
| h1 | Black (900) | 2.5rem | 1.2 |
| h2 | Bold (700) | 2rem | 1.2 |
| h3 | Bold (700) | 1.5rem | 1.2 |
| h4 | Medium (500) | 1.25rem | 1.2 |
| h5 | Medium (500) | 1.125rem | 1.2 |
| h6 | Medium (500) | 1rem | 1.2 |
| Body | Normal (400) | 1rem | 1.5 |
| Small | Normal (400) | 0.875rem | 1.5 |

## RTL Support
The typography system automatically handles RTL languages (Persian, Arabic):
- Text direction detection via `[dir="rtl"]`, `[lang="fa"]`, `[lang="ar"]`
- Optimized line heights for Arabic/Persian scripts
- Proper letter spacing
- Font feature settings for script-specific rendering

## Performance Optimization
- `font-display: swap` prevents layout shift during font loading
- Local font files in `/public/fonts/` for fast loading
- Font smoothing (antialiasing) enabled for all platforms
- Optimized kerning and ligatures

## Browser Support
- Chrome/Edge
- Firefox
- Safari
- All modern browsers with TTF support

## Maintenance
All typography is managed through:
- `src/index.css` - Font declarations and base styles
- `tailwind.config.js` - Tailwind theme extensions

**Never hardcode font-family values in components.** Always use the CSS variables or Tailwind utilities.