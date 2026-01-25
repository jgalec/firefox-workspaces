## Project Rules
- Communication with the user: Spanish.
- Code (variables, functions, comments, documentation): English.

## WebExtension Anatomy (MDN Standards)
Reference: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Anatomy_of_a_WebExtension

1. **manifest.json**: The single required file. Holds metadata, permissions, and paths.
2. **Background Scripts**:
   - The extension's central "brain".
   - Handles events (browser startup, tab changes).
   - In Firefox MV3, these are non-persistent scripts (Event Pages).
3. **Content Scripts**:
   - JavaScript/CSS injected into web pages.
   - Access/modify the DOM of pages.
   - Communicate with background scripts via messages.
4. **UI Elements**:
   - **Browser Action (Popup)**: The button in the toolbar and its dropdown HTML.
   - **Sidebar Action**: A panel displayed in the browser's sidebar.
   - **Options Page**: A dedicated page for extension settings.
5. **Web Accessible Resources**:
   - Assets (images, fonts, HTML) bundled with the extension that need to be accessible by web page contexts.

## Mozilla Protocol Color Palette (Reference)
Source: https://protocol.mozilla.org/docs/fundamentals/color

### Neutrals
- **Mozilla Black:** `#161616` (Primary background dark / Primary text light)
- **Mozilla White:** `#fafafa` (Primary background light / Primary text dark)
- **Mozilla Gray +1:** `#e8e8e8` (Border light)
- **Mozilla Gray -1:** `#6d6d6d` (Secondary text light)
- **Mozilla Gray:** `#b3b3b3` (Secondary text dark / Input borders)
- **Mozilla Gray -2:** `#414141` (Border dark)

### Semantic Colors
- **Success (Mozilla Green):** `#00d230`
- **Error (Red 50):** `#ff4f5e`
- **Warning (Orange 50):** `#ff7139`

### Brand Colors
- **Primary Blue:** `#0060df`
- **Primary Blue Hover:** `#003eaa`