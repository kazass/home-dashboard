# Home Dashboard

Offline-first household dashboard for a dedicated tablet. The app is hosted as
a static PWA on GitHub Pages; household records and uploaded photos stay in the
browser's IndexedDB and are not uploaded to GitHub.

Live app: https://kazass.github.io/home-dashboard/

## Local development

Serve the repository over HTTP so IndexedDB, geolocation, and the service
worker behave like they do in production. On Windows PowerShell:

```powershell
./tools/serve.ps1
```

Then open `http://localhost:8080/`.

## Verification

The project uses Node's built-in test runner and has no package dependencies:

```bash
node --test tests/*.test.js
```

Before releasing, also syntax-check every script and test backup export/import,
offline reload, task completion/undo, recurring dates, and photo views on the
target tablet.

## Data recovery

Use **Backup → Export backup file** regularly. Version 2 backups contain all
IndexedDB records and photos plus application settings and dashboard layout.
Restore validates and decodes the entire file before replacing the current
database, and the database replacement is transactional.
