# Home Dashboard v3 preview

This branch preserves the existing dashboard while adding a tablet-friendly Today workspace. The original `main` branch and its GitHub Pages deployment are unchanged.

## What is included

- Today priorities, a seven-day strip and Everyone/person filters.
- Today / Calendar / Tasks / Kitchen / More navigation. Existing garden, notes, ideas, recipes, meals, goals, activities, statistics, music, decision helper and release notes remain available.
- Quick add for tasks, chores, events, shopping and notes.
- Transactional completion, postponing and reassignment, with Undo. Completion records and task changes commit together.
- Eleven optional widgets; reorder, hide and choose sizes through Edit layout. Daily, Week planner and Focus presets. Narrow and wide screens keep separate layouts.
- Five themes, light/dark/system mode and standard/large text. Appearance does not change layout.
- Accessible dialog labels, keyboard focus management and Escape dismissal.

## Bring over household data

The preview starts empty. Export a JSON backup from the original dashboard, then use More → Settings → Backup & restore here. Import creates a separate copy in this browser; it does not sync subsequent changes.

The preview uses IndexedDB `home-dashboard-v3` and `hd-v3-*` preferences. The original uses `home-dashboard` and `hd-*`. Keep backups for each version. Browser storage is device-local: phone/tablet sync and assistant actions are not connected.

## Develop and verify

Run `npm ci`, then `npm run dev`. The production app remains plain HTML/CSS/JavaScript with no frontend runtime dependencies. Vite is only a development server. `npm run build` copies public assets to `dist` for the separate private preview.

Run `npm test` for the safety and action regression suite; `npm run check` validates JavaScript syntax. The action tests use fake-indexeddb to verify concurrent completion, Undo and rotating-chore credit.

## Next features

1. Improve meal ingredient preview/merging and full shopping mode.
2. Add backup reminders and clearer update status.
3. Add authenticated shared storage with conflict handling and explicit data migration.
4. Connect ChatGPT actions to that shared action service.
5. Pilot Vinted email notifications after confirming account notification coverage.

ChatGPT, Vinted and shared sync are plans, not working connections. Some secondary feature editors retain their original forms, restyled within the new shell. Android keyboard, PWA installation and long-running offline sessions still need device testing.

---

## Original dashboard

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

Version 2 restores require all application stores; incomplete files, invalid
store values and unsupported version values are rejected before any writes.
Version 1 backups remain supported and leave existing preferences unchanged.
Synchronous write failures explicitly abort the restore transaction.

## Redesign progress

Work continues on `codex/scalable-dashboard-v3`; `main` remains the existing
live dashboard. The original safety patch is preserved at `7772f28` on
`codex/stage1-safety-fixes`.

- Data protection: ten Node regression tests pass, including backup round-trip
  with photo bytes and preferences, malformed import rejection, scoring undo,
  month-end recurrence and explicit transaction abort on a synchronous error.
  These use in-memory storage/transaction doubles, not a browser IndexedDB engine.
- Still required before release: real-browser restore/rollback, completion/undo,
  offline reload and Samsung tablet checks. The cloud preview browser blocked
  the local test address in this work session; no rendered QA pass is claimed.
- Next implementation: Today-first responsive shell, modular widgets and
  independent themes, retaining existing records and features. The visual
  redesign is not implemented yet.
