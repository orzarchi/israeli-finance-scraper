let outLogger = console;

export default {
    overrideLogger(x: any) {
        outLogger = x;
    },
    resetLogger() {
        outLogger = console;
    },
    log: (msg: string, ...args: any[]) => outLogger.info(msg, ...args),
    info: (msg: string, ...args: any[]) => outLogger.info(msg, ...args),
    warn: (msg: string, ...args: any[]) => outLogger.warn(msg, ...args),
    error: (msg: string, ...args: any[]) => outLogger.error(msg, ...args),
    debug: (msg: string, ...args: any[]) => outLogger.debug(msg, ...args)
};
