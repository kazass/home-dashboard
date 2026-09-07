# Home dashboard design

The dashboard should answer “What needs doing today?” quickly, then make the next action easy. A calm household interface takes precedence over dense reports. Existing household features remain available through the five labelled destinations: Today, Calendar, Tasks, Kitchen and More.

## Visual system

Forest is the default direction: a pale neutral canvas, dark green text, white task surfaces, a deep green agenda, soft sage plant care and a restrained warm meal card. Ocean, Sunset, Lavender and Slate use the same components and hierarchy.

| Role | Token or asset | Rule |
| --- | --- | --- |
| Page and cards | `--bg`, `--surface`, `--border` | Separate content with space and subtle borders. |
| Main and supporting text | `--text`, `--text-muted` | Keep useful information readable in every theme. |
| Primary action and selection | `--accent`, `--accent-text` | Use for the selected state and the main action. |
| Supporting card tones | `--surface-soft`, `--surface-warm` | Give plant care and meals distinct, quiet surfaces. |
| Agenda | `--hero-bg`, `--hero-text` | Establish one clear visual anchor above the task list. |
| Type | Local Manrope and Instrument Serif fonts | Manrope for controls and body text; serif display type for the main workspace title. Preserve system fallbacks. |
| Icons | `js/ui-icons.js` | One outline vocabulary. Icons accompany labels; icon-only controls need accessible names. |

Theme values belong in `js/settings.js`; layout and component styling belong in `css/redesign.css`. New features should consume semantic tokens instead of adding their own colour palettes. Household person colours identify assignment and always retain visible names. Appearance changes must not alter records or widget arrangement.

## Component ownership

| Module | Responsibility |
| --- | --- |
| `js/app.js` | Navigation, shared header, quick add, dialogs, settings shell and feedback. |
| `js/today.js` | Selected day, household task list, agenda and widget presentation. |
| `js/workspace.js` | Feature/widget catalogue, layout presets, saved order and sizes. |
| `js/actions.js` | Transactional completion, postpone, reassignment and Undo. Views call these actions rather than maintaining totals. |
| `js/calendar.js`, `js/scheduling.js` | Calendar presentation, local dates and recurrence enumeration shared by the agenda. |
| `js/settings.js` | Appearance, household identity and display preferences. |
| `js/runtime.js`, `js/db.js`, `js/backup.js` | Isolated v3 storage, household persistence and validated backup transfer. |
| Feature modules | Garden, shopping, recipes, notes and other domain-specific editors. |

## Interaction and responsive rules

- Keep completion directly accessible. Put editing and reassignment behind task options; keep postponing visible. Confirm successful changes with feedback and Undo where supported.
- Show all task types through the All task view. The Today preview may be shorter, but its full-list link must preserve access to chores and plant care.
- Treat the selected date consistently across agenda, meals and task defaults. Show a clear return to today when browsing another day.
- Use two content columns when space permits, with priorities first. Stack them on narrow screens. Preserve labelled navigation and comfortable touch targets.
- Save narrow and wide layouts separately; the layout profile boundary is 900 CSS pixels. Widget hiding and rearrangement change presentation only.
- Keep controls in document flow so text enlargement and long household names can reflow. Reserve room for bottom navigation and device safe areas.
- Dialogs manage initial focus, keyboard containment, Escape dismissal and focus restoration. Preserve visible focus, reduced-motion preferences and light/dark/system modes.

## Next feature work

1. Finish consistent secondary editors, ingredient-transfer preview, shopping mode, backup reminders and update status.
2. Validate long-running use, keyboard behaviour, installation and offline recovery on the Samsung tablet.
3. Add authenticated household sync with stable member IDs, explicit migration and conflict handling.
4. Connect ChatGPT actions to the same household action service, with results reflected in the UI.
5. Pilot Vinted notification import only after confirming the supported connection and which account alerts are available.

ChatGPT actions, Vinted notifications and shared sync are **not connected**. Browser-local data and copied backups remain the current persistence model. Automated regression checks are run through `npm test`; device testing is a separate release task.
