import Db from "../Db";
import env from "../env";
import shortid from "shortid";
import {tryDebuggingLocally} from "../debug";

export const changeIds = tryDebuggingLocally(async function () {
    const db = new Db();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - env.MONTHS_TO_SCRAPE);
    const transactions = await db.getTransactions(startDate);
    transactions.forEach(x=>{
        x.id = shortid.generate();
    });

    return db.addTransactions(transactions,true);
});
