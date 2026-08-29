"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddleware = exports.ApplicationError = void 0;
class ApplicationError extends Error {
    constructor(statusCode, message, publicMessage = message) {
        super(message);
        this.statusCode = statusCode;
        this.publicMessage = publicMessage;
        this.name = 'ApplicationError';
    }
}
exports.ApplicationError = ApplicationError;
function getPrismaErrorCode(error) {
    if (!error || typeof error !== 'object' || !('code' in error))
        return undefined;
    return typeof error.code === 'string' ? error.code : undefined;
}
const errorMiddleware = (error, _req, res, _next) => {
    if (error instanceof ApplicationError) {
        res.status(error.statusCode).json({ error: error.publicMessage });
        return;
    }
    const prismaCode = getPrismaErrorCode(error);
    if (prismaCode === 'P2002') {
        res.status(409).json({ error: 'Resource already exists' });
        return;
    }
    if (prismaCode === 'P2025') {
        res.status(404).json({ error: 'Resource not found' });
        return;
    }
    if (process.env.NODE_ENV !== 'test') {
        const name = error instanceof Error ? error.name : 'UnknownError';
        console.error(`[error] unexpected_error type=${name}`);
    }
    res.status(500).json({ error: 'Internal server error' });
};
exports.errorMiddleware = errorMiddleware;
