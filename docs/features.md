# Project Features: Firefox Workspaces

This document details the core functionalities implemented in the Firefox Workspaces extension.

## 1. Workspace Management
- **Creation:** Create new workspaces with custom names and colors.
- **Capture:** Convert the current unmanaged window into a new workspace with a single click.
- **Editing:** Rename or change the color of existing workspaces.
- **Deletion:** Permanent removal of workspaces with a safety confirmation modal.

## 2. Session Persistence
- **Automatic Sync:** Real-time saving of tab changes (creation, movement, updates) within a workspace.
- **Tab Groups:** Support for Firefox's native tab groups (experimental) to maintain complex tab structures.
- **Enhanced Pin Support:** Robust restoration of pinned tabs that appear immediately fixed (no UI jumping), maintaining their state across sessions.
- **Multi-Account Containers:** Full support for [Firefox Multi-Account Containers](https://addons.mozilla.org/en-US/firefox/addon/multi-account-containers/). Workspaces remember which container (e.g., Personal, Work, Banking) each tab belongs to and restores them in the correct context automatically.

## 3. Advanced UI/UX
- **Dynamic Icons:** Integration with Heroicons using a CSS Mask system for `currentColor` support.
- **Active Identification:** A prominent "Pill" indicator in the popup header shows the active workspace name with its associated color.
- **State Indicators:** Visual badges for "Open" workspaces that are currently in other windows.
- **Reorder Mode:** A toggleable mode to reorganize the workspace list with drag-and-drop handles.

## 4. Data Portability
- **Export:** Download all workspace data as a structured JSON backup.
- **Destructive Restore:** A "Legacy Style" import feature that replaces the current state with a backup file, ensuring data consistency as a "Single Source of Truth".
