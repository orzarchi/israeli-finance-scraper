import logger from '../logger';

export const fakeLogger = (callback: (x: string) => void) => ({
    log: (msg: string, ...args: any[]) => callback(msg),
    info: (msg: string, ...args: any[]) => callback(msg),
    warn: (msg: string, ...args: any[]) => callback(`[warn] ${msg}`),
    error: (msg: string, ...args: any[]) => callback(`[error] ${msg}`),
    debug: (msg: string, ...args: any[]) => callback(`[debug] ${msg}`)
});

export class BufferedStdout {
    private buffered = [] as string[];

    constructor(private notifier: (x: string) => void) {
        setInterval(() => this.flushNotifications(), 3000);
    }

    public startListening() {
        logger.overrideLogger(fakeLogger(this.queueNotifications.bind(this)));
    }

    public stopListening() {
        logger.resetLogger();
    }

    private queueNotifications(message: string) {
        this.buffered = [...this.buffered, message];
    }

    private flushNotifications() {
        const message = this.buffered.join('\n');
        message && this.notifier(message);
        this.buffered = [];
    }
}
