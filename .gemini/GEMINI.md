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

