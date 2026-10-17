# Account discussions

Lightweight, self-hosted discussions use the existing PostgreSQL database, accounts and detail panels. No external comment service or additional runtime dependency is required.

## Entry points and visibility

- Family movement details: sender and recipient, while they remain members of the family. The original transfer note is shown separately; `family_movement_details` notes and attachments stay private and are never copied into messages.
- Shared-book transaction details, including chart detail views: members who can currently view that record. Viewers may discuss without permission to change the transaction. Private-book transactions do not show a discussion. Linked copies in different books have separate discussions so a private or differently shared copy cannot expose the other book's messages.
- Cost project details: the owner and participants with the same current family membership required by the existing project API. Member income offsets and private sources are not included in discussion metadata.
- Recurring plans: use Discussion for the plan, Current cycle for the next due date, or Discuss cycle in cycle history. Plan and cycle messages are separate. Previous discussions remain available if an unprocessed plan's first date changes.

All members currently authorized for a discussion can read its history. Removing and subsequently restoring access follows the source record's access rules, including historical messages.

Messages contain plain text, up to 2,000 characters, with an optional quoted reply to a message in the same discussion. Quotes stay one level deep. Messages, quoted reply authors, the composer and home message cards reuse the existing member Avatar component; avatar changes are read from current profiles. This first version does not include attachments, mentions, editing, deletion, reactions or private messages.

## Receipts and home inbox

Receipt confirmation can include an optional reply in the home receipt panel, Family movements, project settlements and recurring share receipts. Confirmation and its reply are saved together. Retrying a completed confirmation does not add another reply. A discussion message alone never confirms receipt or alters money, costs or member acceptance.

Home Account messages groups unread messages by discussion and excludes your own messages. Each card shows the source, latest unread message and unread count. Open the discussion or jump to the original record. Opening a cost project from a cycle's payment history uses the project's separate discussion; the cycle discussion remains under its plan.

Lists paginate: 20 messages per discussion and five discussions per inbox page. Latest messages appear chronologically; Older/Newer controls load adjacent pages. Viewing the latest discussion page when its section is visible marks messages through the displayed last message as read. Reading an older page does not clear newer unread messages.

Visible pages refresh every 30 seconds and on window focus. Local posting and reading refresh the inbox immediately. This is polling, not instant cross-device delivery or browser push notifications. Access is resolved against the source records on every request, including inbox previews; deleted records and removed members do not retain access through notifications.

## Database update

`scripts/init.mjs` now applies `scripts/discussions-schema.sql` after the existing schemas. It adds `discussion_threads`, `discussion_messages` and `discussion_reads`; it does not publish or migrate existing private notes. Run the normal initializer against the intended database before starting this revision. Existing deployments must include the new SQL file in their release. No production migration is performed by editing the development repository.

## Verification

Use an isolated local database whose name ends in `_test`:

```sh
DISCUSSION_TEST_DATABASE_URL=postgres://USER:PASSWORD@127.0.0.1:PORT/discussions_test \
  node --import tsx --test tests/discussions-db.test.ts
npm run typecheck
npm test
npm run build
```

The database test applies the schemas, creates synthetic fixtures inside a transaction and rolls them back. It checks all four audiences, viewer participation, private-note exclusion, quoted replies, cross-discussion reply rejection, retry deduplication, pagination, unread cursors, separate cycles, receipt replies and revoked/deleted access.

The browser test seeds synthetic records and sessions into an isolated local test database, so use a disposable database. Start the app with the same database, CNY/Chinese and `APP_ORIGIN` matching `DISCUSSION_TEST_ORIGIN`, then run:

```sh
DATABASE_URL=postgres://USER:PASSWORD@127.0.0.1:PORT/discussions_test \
DISCUSSION_TEST_ORIGIN=http://127.0.0.1:3126 \
TEST_ARTIFACT_DIR=/absolute/path/to/screenshots \
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
  node --import tsx scripts/discussions-browser.ts
```

Browser checks cover home messages, quoted transfer replies, private-note preservation, shared-book viewer replies, source navigation, projects, separate plan/cycle discussions and desktop/mobile layouts. Test accounts use non-login passwords; sessions are created only in the disposable database.
