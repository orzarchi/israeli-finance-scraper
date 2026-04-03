import { sql } from 'drizzle-orm';
import { sqliteTable, text, real, integer, check } from 'drizzle-orm/sqlite-core';

export const transactions = sqliteTable('transactions', {
    docId: text('doc_id').primaryKey(),
    id: text('id'),
    provider: text('provider').notNull(),
    account: text('account').notNull(),
    date: integer('date', { mode: 'timestamp' }).notNull(),
    processedDate: integer('processed_date', { mode: 'timestamp' }).notNull(),
    originalAmount: real('original_amount').notNull(),
    originalCurrency: text('original_currency').notNull(),
    chargedAmount: real('charged_amount').notNull(),
    description: text('description').notNull(),
    memo: text('memo'),
    installmentsNum: integer('installments_num'),
    installmentsTotal: integer('installments_total'),
    scrapeId: text('scrape_id'),
    scrapeDate: integer('scrape_date', { mode: 'timestamp' }),
    userId: text('user_id').notNull(),
    status: text('status').notNull(),
    approvalNumber: text('approval_number'),
    userNote: text('user_note'),
    category: text('category'),
});

export const configurations = sqliteTable('configurations', {
    docId: text('doc_id').primaryKey(),
    id: text('id').notNull(),
    payload: text('payload').notNull(),
}, table => [
    check('configurations_payload_is_json', sql`json_valid(${table.payload})`),
]);
