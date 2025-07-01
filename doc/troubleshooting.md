# Troubleshooting Guide

## Editor Shows Stale or Incorrectly Formatted Content

**Symptom:**

After code changes related to block parsing or rendering (e.g., in `frontend/src/components/Editor.tsx` or related backend logic), the editor continues to display old, stale, or incorrectly formatted content (like `(Unknown Element: ...)` instead of actual dialogue) even after refreshing the page or rebuilding the frontend.

**Cause:**

The `Editor.tsx` component uses `y-indexeddb` to persist the Yjs document locally in the browser's IndexedDB storage. This provides offline capabilities and faster initial loads. However, if the formatting logic changes, the editor might load the old, stale data from IndexedDB before attempting to fetch or apply new formatting rules. A standard refresh or even a hard refresh (Ctrl+Shift+R) often does **not** clear IndexedDB.

**Resolution:**

You need to manually clear the IndexedDB storage for the application in your browser to force it to fetch and render the content using the latest code.

**Steps:**

1.  Open **Developer Tools** in your browser (usually F12).
2.  Navigate to the **Application** tab (Chrome/Edge) or **Storage** tab (Firefox).
3.  Find **IndexedDB** in the storage tree on the left-hand side.
4.  Locate the entry for the application's origin (e.g., `http://localhost:8080`).
5.  Expand it if necessary and find the database related to the application (e.g., `theater-script-...`).
6.  Right-click on the database name or the origin itself.
7.  Select **Delete** or **Clear** from the context menu.
8.  **Refresh** the application page in your browser.

The editor should now load without the stale IndexedDB data, fetching the latest script content from the backend and applying the current formatting logic. 