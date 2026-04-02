import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import env from '../env';
import { createStorageProvider } from '../storage';
import { TransactionUpdate } from '../types';
import logger from '../logger';
import moment from 'moment-timezone';
import _ from 'lodash';
import { scrape } from './scrape';

const app = new Hono();
let running = false;

// Health check
app.get('/', (c) => {
    return c.json({ isActive: running });
});

// Fetch transactions — used by Google Sheets
app.get('/fetchTransactions', async (c) => {
    if (env.AUTH && c.req.query('auth') !== env.AUTH) {
        return c.text('Unauthorized', 401);
    }

    const startDateParam = c.req.query('startDate');
    if (!startDateParam) {
        return c.text('startDate is required', 400);
    }

    try {
        const db = createStorageProvider();
        const startDate = new Date(startDateParam);
        const daysAgo = moment().diff(startDate, 'days');
        logger.info(`Returning transactions ${daysAgo} days back`);
        const transactions = await db.getTransactions(startDate);
        return c.json(
            transactions.map(tx => ({
                id: tx.id,
                account: tx.account,
                docId: tx.docId,
                date: moment(tx.date).tz('Asia/Jerusalem').toDate(),
                category: tx.category,
                payee: tx.description,
                amount: tx.chargedAmount,
                memo: tx.memo,
            }))
        );
    } catch (e) {
        logger.error((<Error>e).message);
        return c.text('Error', 500);
    }
});

// Update transactions — used by Google Sheets
app.post('/updateTransactions', async (c) => {
    if (env.AUTH && c.req.query('auth') !== env.AUTH) {
        return c.text('Unauthorized', 401);
    }

    try {
        const body = await c.req.json();
        if (!body.transactions) {
            return c.text('transactions are required', 400);
        }

        const db = createStorageProvider();
        await db.updateById(
            body.transactions.map((tx: TransactionUpdate) => _.pick(tx, 'docId', 'userNote', 'category'))
        );
        return c.text('OK');
    } catch (e) {
        logger.error((<Error>e).message);
        return c.text('Error', 500);
    }
});

// Trigger scrape
app.post('/scrape', async (c) => {
    if (env.AUTH && c.req.query('auth') !== env.AUTH) {
        return c.text('Unauthorized', 401);
    }

    if (running) {
        return c.json({ success: false, reason: 'already running' });
    }

    running = true;
    scrape()
        .catch((e) => logger.error('Scrape error:', (<Error>e).message))
        .finally(() => { running = false; });

    return c.json({ success: true });
});

export async function startWeb() {
    const port = env.WEBSERVER_PORT;
    logger.info(`Starting web server on port ${port}`);
    serve({ fetch: app.fetch, port });
}
