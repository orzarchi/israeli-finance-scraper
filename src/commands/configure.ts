import Db from '../Db';
import { getAccounts, getBudgets } from '../ynab';
import { prompt } from 'enquirer';
import _ from 'lodash';
import { FinanciaAccountConfiguration, IPersistedConfiguration, Provider } from '../types';
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

    return (result as { answer: boolean }).answer;
}

async function configureYnab(configurationToEdit: Partial<IPersistedConfiguration>) {
    console.info('Ynab integration:');
    const answer = await confirm('Configure YNAB integration?');
    if (!answer) {
        return;
    }

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
    console.info('Ynab mapping:');

    const firstYnabBudget = configurationToEdit.ynabBudgets[0];

    const financiaAccounts = configurationToEdit.accountsConfig || [];

    for (const financialAccountConfiguration of financiaAccounts) {
        financialAccountConfiguration.accounts = financialAccountConfiguration.accounts || [];

        let moreAccountsRequired = true;
        while (moreAccountsRequired) {
            const ynabAccountName = await choice(
                `For scraper ${financialAccountConfiguration.id} choose matching ynab account`,
                firstYnabBudget.accounts.map(x => x.name)
            );
            const ynabTargetAccountId = firstYnabBudget.accounts.find(x => x.name === ynabAccountName)!.id;
            const [userAccountName] = await question(
                `Scraper given name for account? (This is usually only known after the first scrape. For credit cards, usually 4 last digits)`
            );

            const payingYnabAccountName = await choice(
                `Is account provider ${
                    financialAccountConfiguration.id
                } a credit card? If so, which ynab account is the paying bank account?`,
                firstYnabBudget.accounts.map(x => x.name).concat(['Not a credit card'])
            );

            let payingYnabAccountId = null;
            if (payingYnabAccountName !== 'Not a credit card') {
                payingYnabAccountId = firstYnabBudget.accounts.find(x => x.name === payingYnabAccountName)!.id;
            }

            financialAccountConfiguration.accounts.push({
                accountName: userAccountName,
                ynabTargetBudgetId: firstYnabBudget.id,
                ynabTargetAccountId,
                payingYnabAccountId: payingYnabAccountId || undefined
            });
            moreAccountsRequired = await confirm(
                `Add another account for provider for ${financialAccountConfiguration.id}`
            );
        }
    }
}

async function configureScrapers(configurationToEdit: Partial<IPersistedConfiguration>) {
    console.info('Scraper configuration:');
    configurationToEdit.accountsConfig = configurationToEdit.accountsConfig || [];
    let moreAccountsRequired = true;
    while (moreAccountsRequired) {
        const configurationId = await choice(
            'Which scraper to edit?',
            configurationToEdit.accountsConfig.map(x => x.id).concat(['Create new'])
        );
        let scraperToEdit: FinanciaAccountConfiguration | null = null;
        if (configurationId === 'Create new') {
            scraperToEdit = {} as FinanciaAccountConfiguration;
            configurationToEdit.accountsConfig.push(scraperToEdit);
        } else {
            scraperToEdit = configurationToEdit.accountsConfig.find(x => x.id === configurationId)!;
        }

        const [accountId] = await question(`Scraper friendly name? (e.g. Mom's secret card)`);
        const scraperProvider = await choice(`Scraper type?`, Object.keys(Provider));
        const [username, password] = await question('Username?', 'Password?');
        scraperToEdit.id = accountId;
        scraperToEdit.companyId = scraperProvider as Provider;
        scraperToEdit.credentials = { username, password };

        moreAccountsRequired = await confirm(
            `Add/edit another scraper?`
        );
    }
}

export const configure = async function() {
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
    await configureScrapers(configurationToEdit);
    await configureScrapersYnabMapping(configurationToEdit);
    await db.updateConfiguration(configurationToEdit.persistenceId, configurationToEdit.toJson());
};
