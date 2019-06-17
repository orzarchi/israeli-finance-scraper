import Db from '../Db';
import { tryDebuggingLocally } from '../debug';
import { getAccounts, getBudgets } from '../ynab';
import { prompt } from 'enquirer';
import _ from 'lodash';
import { IPersistedConfiguration } from '../types';
import { Configuration } from '../Configuration';

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

async function choice(message: string, choices: string[]) {
    const result = await prompt({
        type: 'select',
        name: 'choices',
        choices,
        message
    });

    return (result as { [x: string]: string }).choices;
}

async function confirm(message: string) {
    const result = await prompt({
        type: 'confirm',
        name: 'answer',
        message
    });

    return (result as { [x: string]: boolean }).answer;
}

async function configureYnab(configurationToEdit: Partial<IPersistedConfiguration>) {
    if (!configurationToEdit.ynabApiKey) {
        [configurationToEdit.ynabApiKey] = await question('YNAB API Key?');
    }
    const budgets = await getBudgets(configurationToEdit.ynabApiKey);
    configurationToEdit.ynabBudgets = budgets.map(x => ({ id: x.id, name: x.name, accounts: [] }));
    const firstBudget = configurationToEdit.ynabBudgets[0];

    const accounts = await getAccounts(configurationToEdit.ynabApiKey, firstBudget.id);
    firstBudget.accounts = accounts.map(x => ({
        id: x.id,
        name: x.name,
        transferAccountId: x.transfer_payee_id
    }));
}

async function configureScrapersYnabMapping(configurationToEdit: Partial<IPersistedConfiguration>) {
    if (!configurationToEdit.ynabBudgets || !configurationToEdit.ynabBudgets.length) {
        return;
    }

    const firstYnabBudget = configurationToEdit.ynabBudgets[0];

    const badAccounts =
        configurationToEdit.accountsConfig &&
        configurationToEdit.accountsConfig.filter(x => !_.isArray(x.accounts) || !x.accounts.length || _.has(x,'ynab'));
    if (!badAccounts) {
        return;
    }

    for (const badAccount of badAccounts) {
        badAccount.accounts=[];
        let moreAccountsRequired = true;
        while (moreAccountsRequired) {
            const ynabAccountName = await choice(
                `For provider ${badAccount.id} choose matching ynab account`,
                firstYnabBudget.accounts.map(x => x.name)
            );
            const ynabTargetAccountId = firstYnabBudget.accounts.find(x => x.name === ynabAccountName)!.id;
            const [userAccountName] = await question(`Scraper given name for account?`);

            const payingYnabAccountName = await choice(
                `Is account provider ${badAccount.id} a credit card? If so, which ynab account is the paying bank account?`,
                firstYnabBudget.accounts.map(x => x.name).concat(['Not a credit card'])
            );

            let payingYnabAccountId = null;
            if (payingYnabAccountName !== 'Not a credit card') {
                payingYnabAccountId = firstYnabBudget.accounts.find(x => x.name === payingYnabAccountName)!.id;
            }

            badAccount.accounts.push({
                accountName: userAccountName,
                ynabTargetBudgetId: firstYnabBudget.id,
                ynabTargetAccountId,
                payingYnabAccountId: payingYnabAccountId || undefined
            });
            moreAccountsRequired = await confirm(`Add another account for provider for ${badAccount.id}`);
        }
    }
}

export const configure = tryDebuggingLocally(async function() {
    const db = new Db();
    const configurations = await db.getConfigurations();
    let configurationToEdit = null;
    const configurationId = await choice('Which configuration?', configurations.map(x => x.id).concat(['Create new']));
    if (configurationId !== 'Create new') {
        configurationToEdit = configurations.find(x => x.id === configurationId)!;
    } else {
        const [newName] = await question('Configuration name?');
        configurationToEdit = new Configuration('', { id: newName } as IPersistedConfiguration);
    }

    await configureYnab(configurationToEdit);
    //todo: add new scrapers
    await configureScrapersYnabMapping(configurationToEdit);
    await db.updateConfiguration(configurationToEdit.persistenceId, configurationToEdit.toJson());
});
