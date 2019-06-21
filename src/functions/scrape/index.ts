import { Callback, Context } from 'aws-lambda';
import { scrape } from '../../commands/scrape';
console.log('starting function');
export default async function(e: any, ctx: Context, cb: Callback): Promise<void> {
    try {
        await scrape();
        cb(null, { success: true });
    } catch (err) {
        cb(err, { success: false });
    }
}
