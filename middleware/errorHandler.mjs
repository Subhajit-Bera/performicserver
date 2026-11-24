import { ApiError } from '../utils/ApiError.mjs';
import { isProduction } from '../config/env.mjs';

export const notFoundHandler = (req, _res, next) => {
    next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

const translateDatabaseError = (err) => {
    switch (err.code) {
        case '23505':
            return ApiError.conflict('A record with these unique values already exists');
        case '23503':
            return ApiError.badRequest('Referenced record does not exist', {
                constraint: err.constraint,
            });
        case '23514':
            return ApiError.badRequest('Value violates a database constraint', {
                constraint: err.constraint,
            });
        case '22P02':
        case '22001':
        case '22003':
            return ApiError.badRequest('Malformed input value');
        default:
            return null;
    }
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
    const requestId = req.id;

    if (err instanceof ApiError) {
        if (err.status >= 500) console.error(`[${requestId}] API error:`, err.message);
        return res.status(err.status).json({
            message: err.message,
            ...(err.details ? { details: err.details } : {}),
            requestId,
        });
    }

    if (err?.type === 'entity.parse.failed') {
        return res.status(400).json({ message: 'Request body is not valid JSON', requestId });
    }

    if (err?.type === 'entity.too.large') {
        return res.status(413).json({ message: 'Request body is too large', requestId });
    }

    const translated = translateDatabaseError(err);
    if (translated) {
        return res.status(translated.status).json({
            message: translated.message,
            ...(translated.details ? { details: translated.details } : {}),
            requestId,
        });
    }

    console.error(`[${requestId}] Unhandled error:`, err?.stack || err?.message || err);

    return res.status(500).json({
        message: isProduction ? 'Internal server error' : err?.message || 'Internal server error',
        requestId,
    });
};

export default errorHandler;
