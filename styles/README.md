# CSS structure

The stylesheets have three explicit levels:

1. `tokens.css` — the only source of CSS custom properties and brand values.
2. `layout.css` — shared typography, layout, navigation, footer, buttons, and reusable components.
3. Page stylesheet — styles used only by its matching HTML page.

Every page must load them in that order:

```html
<link rel="stylesheet" href="styles/tokens.css">
<link rel="stylesheet" href="styles/layout.css">
<link rel="stylesheet" href="styles/page-name.css">
```

Page styles must consume tokens with `var(--token-name)`. They must not add `:root`
blocks, declare custom properties, or repeat raw token colors.

Button background and border colors are owned by the shared `.button` rules in
`layout.css`. Page styles may adjust button placement or spacing, but must not
override those colors.

Run the repository check from the project root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-css-tokens.ps1
```
