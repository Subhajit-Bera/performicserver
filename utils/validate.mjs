import { ApiError } from './ApiError.mjs';

const formatIssues = (issues = []) =>
    issues.map((issue) => ({
        field: issue.path.join('.') || '(root)',
        message: issue.message,
    }));

const runPart = (schema, value, label) => {
    if (!schema) return value;
    const result = schema.safeParse(value);
    if (!result.success) {
        throw ApiError.badRequest(`Invalid ${label}`, formatIssues(result.error?.issues));
    }
    return result.data;
};

/**
 * Validates and replaces req.body / req.query / req.params with parsed values.
 * Schemas are optional per part so a route can validate only what it uses.
 */
export const validate = ({ body, query, params }) => (req, _res, next) => {
    try {
        if (body) req.body = runPart(body, req.body, 'request body');
        if (query) req.validatedQuery = runPart(query, req.query, 'query string');
        if (params) req.params = runPart(params, req.params, 'path parameters');
        next();
    } catch (err) {
        next(err);
    }
};

export default validate;
