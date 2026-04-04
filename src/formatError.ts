export function getErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}

export function formatError(error: unknown) {
    if (error instanceof Error) {
        return error.stack || getErrorMessage(error);
    }

    return String(error);
}
