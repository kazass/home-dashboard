import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
export const households = sqliteTable('households', {
  owner: text('owner').primaryKey(), revision: integer('revision').notNull().default(0),
  operation: text('operation').notNull().default(''), updatedAt: integer('updated_at').notNull().default(0),
});
export const records = sqliteTable('records', {
  owner: text('owner').notNull(), store: text('store').notNull(), id: text('id').notNull(),
  value: text('value').notNull(),
}, t => [primaryKey({columns:[t.owner,t.store,t.id]})]);
