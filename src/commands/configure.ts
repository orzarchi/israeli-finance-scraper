import Db from '../Db';
import { tryDebuggingLocally } from '../debug';
import { getAccounts, getBudgets } from '../ynab';
import { prompt } from 'enquirer';
import _ from 'lodash';

async function question(...messages: string[]): Promise<string[]> {
    const responses = (await prompt(
        messages.map((message: string, index: number) => ({
            type: 'input',
            name: 'answer' + index,
            message
        }))
    )) as { [x: string]: string };

    return _(responses)
        .keys()
        .sort()
        .value()
        .map((x: string) => responses[x]);
}

export const configure = tryDebuggingLocally(async function() {
    const db = new Db();
    const configurations = await db.getConfigurations();
    const bestConfiguration = configurations.find(x => x.id === 'or');
    if (bestConfiguration) {
        if (!bestConfiguration.ynabApiKey) {
            [bestConfiguration.ynabApiKey] = await question('YNAB API Key?');
        }
        const budgets = await getBudgets(bestConfiguration.ynabApiKey);
        bestConfiguration.ynabBudgets = budgets.map(x => ({ id: x.id, name: x.name, accounts: [] }));
        const firstBudget = bestConfiguration.ynabBudgets[0];

        const accounts = await getAccounts(bestConfiguration.ynabApiKey, firstBudget.id);
        firstBudget.accounts = accounts.map(x => ({
            id: x.id,
            name: x.name,
            transferAccountId: x.transfer_payee_id
        }));
        await db.updateConfiguration(bestConfiguration.persistenceId, bestConfiguration.toJson());
    }
});
