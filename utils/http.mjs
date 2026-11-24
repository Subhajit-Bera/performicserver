import { ApiError } from './ApiError.mjs';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const sanitizeUser = (user) => {
    if (!user) return null;
    const { password_hash, refresh_token, ...safe } = user;
    return safe;
};

export const parsePagination = (query = {}) => {
    const rawPage = Number.parseInt(query.page, 10);
    const rawLimit = Number.parseInt(query.limit, 10);

    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;

    return { page, limit, offset: (page - 1) * limit };
};

export const paginated = (rows, { page, limit }, total) => ({
    data: rows,
    meta: {
        page,
        limit,
        total,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
        hasNext: page * limit < total,
        hasPrev: page > 1,
    },
});

const SAFE_SORT_COLUMNS = /^[a-z_][a-z0-9_]*$/i;

export const parseSort = (query = {}, allowed, fallback) => {
    const requested = typeof query.sort === 'string' ? query.sort.trim() : '';
    if (!requested) return fallback;

    const descending = requested.startsWith('-');
    const column = descending ? requested.slice(1) : requested;
    if (!allowed.includes(column) || !SAFE_SORT_COLUMNS.test(column)) {
        throw ApiError.badRequest(`Invalid sort field. Allowed: ${allowed.join(', ')}`);
    }
    return { column, direction: descending ? 'DESC' : 'ASC' };
};

export const parseId = (value, label = 'id') => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw ApiError.badRequest(`${label} must be a positive integer`);
    }
    return parsed;
};

export const parseIdList = (value, label = 'ids') => {
    if (value === undefined || value === null || value === '') return [];
    const parts = Array.isArray(value) ? value : String(value).split(',');
    const ids = parts.map((part) => Number.parseInt(String(part).trim(), 10));
    if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
        throw ApiError.badRequest(`${label} must be a comma-separated list of positive integers`);
    }
    return [...new Set(ids)];
};
