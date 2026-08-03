# Home Dashboard — Plan

Shared household dashboard for a dedicated Samsung tablet (Kasparas + Izolda). Runs as an installable PWA, works offline, no backend server, no login.

## Decisions locked in

- **Hosting:** static site, deployed to GitHub Pages, installed to home screen as a PWA (offline via service worker). Deploy step needs explicit go-ahead + repo details before pushing anything public.
- **Data:** IndexedDB in the browser, on-device only. GitHub hosts code, never personal data.
- **Weather/holidays location:** device GPS (cached after first grant). Holidays via Nager.Date, country = LT.
- **Photos** (plants + recipes): either upload from tablet camera/gallery (compressed client-side) or paste an image URL. No auto web image scraping.
- **Recipes:** manual entry with an optional source URL field. No auto-scraping (CORS makes it unreliable on a static site anyway).
- **Google Calendar:** simple, no-OAuth integration — a one-tap "Add to Google Calendar" link per event (calendar.google.com render URL trick), plus the tablet's own Google Calendar gets shared with Kasparas' and Izolda's personal accounts once (done in Google's UI, not by the app) so anything added there mirrors to phones automatically.
- **Multi-user model:** no auth. Items carry an "assigned to: Kasparas / Izolda / Both" tag. Recipes carry two separate rating fields.
- **v1 extras included:** meal planner (linked to Recipes, auto-adds missing ingredients to Shopping list) and chores points/streaks (on Recurring Maintenance).
- **Deferred to v2 backlog (not building now):** weekend activity suggestions from weather + Ideas tags, idle/ambient screensaver mode, full Google Calendar OAuth auto-sync, smart-home quick-launch shortcuts.

## Screens

- **Dashboard (home):** month calendar w/ week-view toggle, due today, due this week, upcoming holidays, upcoming trips, weather, mini Notes + mini Shopping list previews.
- **Notes** (full)
- **Shopping list** (full, receives auto-added items from Meal Planner)
- **Home/Work**
- **Scheduling**
- **Recurring maintenance** — assigned person, frequency, next-due, streak/points on completion
- **Ideas / someday-todo**
- **Garden** — plants, watering schedule, care notes, photos
- **Recipes** — manual entry + source link, per-person ratings, feeds Meal Planner

## Stack

Vanilla HTML/CSS/JS, no build step, no framework. IndexedDB wrapper for storage. manifest.json + service worker for PWA/offline. Open-Meteo (weather) and Nager.Date (holidays) — both free, no API key. Responsive CSS for tablet touch (portrait/landscape) and Samsung DeX windowed desktop mode.

## Build phases (tracked in TaskCreate)

0. Scaffold — folder structure, PWA shell, nav, IndexedDB wrapper, base responsive CSS
1. Dashboard — calendar/week view, agenda, weather, holidays, Google Calendar links
2. Notes + Shopping list
3. Home/Work + Scheduling + Recurring Maintenance (+ streaks)
4. Ideas/todo
5. Garden
6. Recipes + Meal Planner (+ auto shopping list)
7. Polish — JSON export/import backup, PWA install check, offline test, responsive pass
8. Deploy to GitHub Pages (explicit go-ahead required) + install on tablet

Each phase gets rendered in-browser at tablet size and checked before moving to the next, instead of an unattended build-everything loop.
