import {getUncategorizedTransactions, getYnabCategoryIdLookup, updateTransactions} from '../ynab';
import _ from 'lodash';
import {csvFileCategorizationProvider} from "../categorization/CsvFileCategorizationProvider";
import {CategorizationProvider} from "../categorization";
import {applyLearnedCategories} from "../categorization/apply";
import Db from "../Db";

async function categorize(
    ynabApiKey:string,
    budgetId: string,
    ...categorizationProviders: CategorizationProvider[]
) {
    const ynabCategoryIdLookup = (await getYnabCategoryIdLookup(ynabApiKey,budgetId)).map(x => [x.name,x.id]);
    const uncategorizedTx = await getUncategorizedTransactions(ynabApiKey,budgetId);
    let stillUncategorizedTx = uncategorizedTx;

    for(const categorizationProvider of categorizationProviders){
        stillUncategorizedTx = await applyLearnedCategories(
            stillUncategorizedTx,
            _.fromPairs(ynabCategoryIdLookup),
            categorizationProvider
        );
    }

    for (const uncategorizedTx of Object.keys(_.groupBy(stillUncategorizedTx,x=>x.payee_name))){
        console.warn(`Unknown category for payee ${uncategorizedTx}`);
    }

    const newlyCategorizedTx = _.difference(uncategorizedTx,stillUncategorizedTx);

    if (newlyCategorizedTx.length) {
        console.info(`Categorized ${newlyCategorizedTx.length} transactions`);
        await updateTransactions(ynabApiKey,budgetId, newlyCategorizedTx);
    }
}

async function test(){
    const db = new Db();
    const configurations = await db.getConfigurations();
    for (const configuration of configurations) {
        await categorize(configuration.ynabApiKey, configuration.ynabBudgets[0].id, csvFileCategorizationProvider)
    }
}

test().catch(err => console.error(err));
