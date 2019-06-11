export const tryDebuggingLocally = (func: () => Promise<any>) => {
    const isRunningInLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
    if (!isRunningInLambda) {
        func().catch(x=>console.error(x))
    }

    return func;
};
