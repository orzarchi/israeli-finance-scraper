import {Provider} from "./types";

export default {
    ONLY_PROVIDERS: (process.env['ONLY_PROVIDERS'] || '').replace(' ','').split(',') as Provider[]
}
