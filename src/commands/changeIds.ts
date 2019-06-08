import Db from "../Db";
import env from "../env";
import shortid from "shortid";

export async function changeIds() {
    const db = new Db();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - env.MONTHS_TO_SCRAPE);
    const transactions = await db.getTransactions(startDate);
    transactions.forEach(x=>{
        x.id = shortid.generate();
    });

    return db.addTranscations(transactions,true);
}
