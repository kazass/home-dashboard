# Home Dashboard 3.5

A tablet-first, offline-capable home hub for Kasparas and Izolda.

- **Home:** live clock, next event, and configurable Kitchen, Garden, Housework, Trips, Sales, and Notes tiles.
- **Week:** events, next-due chores, plant care and dinners; review recipe ingredients before adding groceries.
- **Sales & parcels:** manual listings, shelf locations, send-by dates and status tracking.
- **Appearance:** Ink, Cobalt, Cherry, Volt and Copper; light/dark/system modes and large text.
- **Display mode:** a large clock with the next event; return using Back to home or Escape.

All existing tasks, recipes, garden records, calendar, shopping, notes, ideas, statistics, activities, goals, music and backup features remain available. The earlier detailed Today screen is linked from Home.

## Data and upgrades

v3.5 keeps v3 household records in the same browser database. The original v2 dashboard uses a separate database and is unchanged. To bring records from the original app or another device, export a JSON backup there, then use **Settings → Backup & restore** here. Import replaces this version’s records after validation. Backups include sales, photos, themes and layout. Backups from versions 1 and 2 remain supported.

Data belongs to the browser and site where it was entered. Export regularly; shared phone/tablet sync is not connected. The local time zone of your device controls the clock and calendar dates. Vinted notification forwarding and ChatGPT actions are future integrations; sales tracking works manually.

## Install

Open the dashboard in Chrome on Android, then choose **Add to Home screen / Install app**. First load requires a connection; saved household features work offline after caching. Spotify and live weather require a connection.

## Develop

```sh
npm ci
npm run dev
npm test
npm run check
npm run build
```

This is a vanilla JavaScript PWA. Feature modules share IndexedDB records and transactional household actions; appearance and hub-area registries remain independent. See V3.5.md for design and compatibility decisions.

## Previous versions

The original app remains on main. The v3.0 preview remains on codex/scalable-dashboard-v3. Version 3.5 is developed on codex/home-hub-v3.5.
