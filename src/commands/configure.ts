import Db from '../Db';
import { getAccounts, getBudgets } from '../ynab';
import { FinanciaAccountConfiguration, IPersistedConfiguration } from '../types';
import { Configuration } from '../Configuration';
import { CompanyTypes } from 'israeli-bank-scrapers-core';
import { choice, confirm, question } from './cli';

async function configureYnab(configurationToEdit: Partial<IPersistedConfiguration>) {
    const answer = await confirm('Configure YNAB integration?');
    if (!answer) {
        return;
    }

    console.info('YNAB integration:');

    if (!configurationToEdit.ynabApiKey) {
        configurationToEdit.ynabApiKey = await question('YNAB API Key?');
    }
    const budgets = await getBudgets(configurationToEdit.ynabApiKey);

    const budgetName = await choice('YNAB Budget Name?', budgets.map(x => x.name));

    const budget = budgets.filter(x => x.name === budgetName);

    configurationToEdit.ynabBudgets = budget.map(x => ({ id: x.id, name: x.name, accounts: [] }));
    const firstBudget = configurationToEdit.ynabBudgets[0];

    const accounts = await getAccounts(configurationToEdit.ynabApiKey, firstBudget.id);
    firstBudget.accounts = accounts.map(x => ({
        id: x.id,
        name: x.name,
        transferAccountId: x.transfer_payee_id
    }));
}

async function configureScrapersYnabMapping(configurationToEdit: Partial<IPersistedConfiguration>) {
    const financiaAccounts = configurationToEdit.accountsConfig || [];

    if (!configurationToEdit.ynabBudgets || !configurationToEdit.ynabBudgets.length || !financiaAccounts.length) {
        return;
    }

    const answer = await confirm('Configure Ynab mapping?');
    if (!answer) {
        return;
    }

    console.info('Ynab mapping:');

    const firstYnabBudget = configurationToEdit.ynabBudgets[0];

    let moreConfigurationsRequired = true;
    while (moreConfigurationsRequired) {
        const configurationId = await choice('Which Account to edit?', financiaAccounts.map(x => x.id));
        const financialAccountConfiguration = financiaAccounts.find(x => x.id === configurationId)!;

        financialAccountConfiguration.accounts = financialAccountConfiguration.accounts || [];

        let moreAccountsRequired = true;
        while (moreAccountsRequired) {
            const ynabAccountName = await choice(
                `For scraper ${financialAccountConfiguration.id} choose matching ynab account`,
                firstYnabBudget.accounts.map(x => x.name)
            );
            const ynabTargetAccountId = firstYnabBudget.accounts.find(x => x.name === ynabAccountName)!.id;
            const userAccountName = await question(
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
                `Add another account (cc/bank account) for credentials for ${
                    financialAccountConfiguration.id
                } provider?`
            );
        }

        moreConfigurationsRequired = await confirm(`Configure another provider?`);
    }
}

async function configureScrapers(configurationToEdit: Partial<IPersistedConfiguration>) {
    const answer = await confirm('Configure Scrapers?');
    if (!answer) {
        return;
    }

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

        const accountId = await question(`Scraper friendly name? (e.g. Mom's secret card)`);
        const scraperCompanyTypes = (await choice(`Scraper type?`, Object.keys(CompanyTypes))) as CompanyTypes;
        let credentials;
        switch (scraperCompanyTypes) {
            case CompanyTypes.hapoalim:
            case CompanyTypes.visaCal:
            case CompanyTypes.leumiCard:
            case CompanyTypes.leumi:
            case CompanyTypes.max:
            case CompanyTypes.mizrahi:
            case CompanyTypes.otsarHahayal:
            case CompanyTypes.beinleumi:
                credentials = {
                    username: await question('Username?'),
                    password: await question('Password?')
                };
                break;
            case CompanyTypes.discount:
                credentials = {
                    id: await question('Id number?'),
                    password: await question('Password?'),
                    num: await question('Number?')
                };
                break;
            case CompanyTypes.isracard:
            case CompanyTypes.amex:
                credentials = {
                    id: await question('Id number?'),
                    card6Digits: await question('Card last 6 digits?'),
                    password: await question('Password?')
                };
                break;
            case CompanyTypes.oneZero:
                credentials = {
                    email: await question('Email?'),
                    password: await question('Password?')
                };
                break;
            default:
                throw new Error('Unsupported provider');
        }

        scraperToEdit.id = accountId;
        scraperToEdit.companyId = scraperCompanyTypes as CompanyTypes;
        scraperToEdit.credentials = credentials;

        moreAccountsRequired = await confirm(`Add/edit another scraper?`);
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
        const newName = await question('Configuration name?');
        configurationToEdit = new Configuration('', { id: newName } as IPersistedConfiguration);
    }

    await configureYnab(configurationToEdit);
    await configureScrapers(configurationToEdit);
    await configureScrapersYnabMapping(configurationToEdit);
    await db.updateConfiguration(configurationToEdit.persistenceId, configurationToEdit.toJson());
};
