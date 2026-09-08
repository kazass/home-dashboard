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

Open **Settings → Connections → Connect this device** on each device, using the same ChatGPT account. The hosted version syncs household records and photos through authenticated D1/R2 storage. Existing local records upload on connection; independent edits merge, and competing edits pause for review. Keep an exported recovery copy. Appearance and layout remain local to each device. This release does not invite a second account automatically.

The `/mcp` connection offers read-household, shopping, task actions and Vinted email import tools. Link that household connection in ChatGPT to use it. Vinted alerts require a separately connected mailbox and an explicit import or scheduled workflow; the app does not log into Vinted or automatically read Gmail. Imported alerts retain their source IDs to prevent duplicates. Parcel statuses remain manually controlled.

The household time zone is captured from the first connected device. Keep participating devices set to the household time zone so their local calendar and the assistant’s completion dates agree.

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

This is a vanilla JavaScript PWA with an ESM Cloudflare Worker. Feature modules share IndexedDB records and transactional household actions; appearance and hub-area registries remain independent. `npm run dev` previews the static interface; cloud routes require the hosted Worker. `npm run build` emits the Worker, client assets and generated D1 migrations. Run `npm run db:generate` after editing `db/schema.ts`. See CONNECTIONS.md for the sync contract and V3.5.md for design decisions.

## Previous versions

The original app remains on main. The v3.0 preview remains on codex/scalable-dashboard-v3. Version 3.5 is developed on codex/home-hub-v3.5.
