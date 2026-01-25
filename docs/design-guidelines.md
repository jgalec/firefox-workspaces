# Design Guidelines

The Firefox Workspaces extension adheres to the **Mozilla Protocol** design system and the principles of **Mozilla UX**.

## 🎨 Color Palette (Mozilla Protocol)
We strictly use the colors defined in the [Mozilla Protocol Color Fundamentals](https://protocol.mozilla.org/docs/fundamentals/color):
- **Backgrounds:** `Mozilla White (#ffffff)` / `Mozilla Black (#161616)`.
- **Text:** High contrast using Mozilla's neutral scale.
- **Accents:** `Primary Blue (#0060df)` for main actions and `Mozilla Green (#00d230)` for success/confirmation.
- **Feedback:** `Red 50 (#ff4f5e)` for destructive warnings.

## 📐 Layout & Typography
- **Font Stack:** Native system fonts as recommended by Mozilla.
- **Hierarchy:** Clear distinction between "Active Info", "Workspace List", and "Action Menus".
- **Density:** Balanced spacing (12px-16px padding) to maintain a modern, airy feel.

## 🧩 Component Design
- **Buttons:** Consistent with Firefox's button style (border-radius: 4px).
- **Modals:** Custom-built overlay modals that match the browser's native confirmation dialog aesthetics.
- **Pills/Badges:** Used for status indicators and the active workspace name, utilizing subtle alpha-transparency backgrounds.

## 🔘 Iconography (Heroicons)
- Icons are implemented via **CSS Masks**.
- **Advantage:** Icons inherit `currentColor`, allowing them to automatically adapt to light/dark modes and hover states without multiple SVG files or complex JS.
- **Stroke:** Consistent 1.5px stroke width for a professional look.
