# Household connections · 3.5.1

This branch extends 3.5; the original main, v3 and v3.5 branches remain available.

## Authority and recovery

- Sites dispatch authenticates requests; the Worker scopes every SQL query and photo key to a hash of the authenticated email. Client-supplied account IDs are never accepted. This release connects devices signed into the same account. Separate household membership/invites are a later explicit setup step.
- D1 stores independent records indexed by owner, store and record ID. A revision gate and one D1 batch atomically apply each change group. Stale writers receive HTTP 409. R2 keeps photo bytes; only content hashes and types enter D1.
- IndexedDB is the offline working copy. An internal store keeps a durable last-accepted baseline and pending upload. Every write transaction, including legacy direct transactions, updates a marker in the same transaction. A three-way merge combines nonoverlapping changes and propagates deletions. Competing edits pause; recovery export precedes choosing a pending group.
- Edits made during upload are retained. Lost upload responses recover by matching the pending accepted values. Refresh or closing the tab retains both local data and sync metadata. Large migrations send at most 500 changed records per transaction; partial uploads continue safely. Photos are capped at 10 MB each and structured records at 100 KB.
- Polling happens every 15 seconds while visible, on reconnect, and shortly after edits. Android can suspend background tabs; no always-running background service is claimed.
- Themes/layout stay local. Household names and the first device’s time zone enter the shared profile. Browser calendar rendering still uses the device time zone.
- API, authentication and photo responses are excluded from service-worker caches. Explicit device connection is needed once; updates never silently upload an existing browser database.

## Assistant and Vinted

The stateless JSON MCP endpoint supports 2025-era Streamable HTTP with initialize, ping, tools/list and tools/call. Authentication/discovery is delegated to Sites. Verify the platform-returned connection details after publication; do not substitute browser cookies or bypass tokens for OAuth.

Tools read household data, deduplicate shopping additions, perform the same pure task transformation used by the UI, and import Vinted email summaries. Repeated source message IDs are ignored even after dismissal. Vinted destinations are validated against an explicit HTTPS domain allowlist. Email summaries are untrusted text. No tool sends messages, places orders or modifies a Vinted account.

The Gmail plugin is a ChatGPT connection, not an OAuth grant to this Worker. Live email ingestion requires the user to link their mailbox and the household MCP server, then run an import or authorize a scheduled workflow. This release includes the destination and inbox UI; it must not label Gmail or an automatic feed connected before that succeeds.

## Verification

Automated tests use the generated SQLite migration and real fake-indexeddb transactions. Coverage includes authentication and account isolation, stale writes, two-device edits/deletions, conflict preservation, edits during upload, lost responses, photo bytes, shared completion accounting, Vinted deduplication and household midnight across DST. Existing recurrence, backup and UI-domain regression tests remain in place.
