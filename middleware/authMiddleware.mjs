import { ApiError } from '../utils/ApiError.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { verifyAccessToken } from '../utils/tokenUtils.mjs';
import { getActiveSession } from '../utils/sessionStore.mjs';

const extractBearerToken = (req) => {
    const header = req.headers?.authorization;
    if (typeof header !== 'string') return null;
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
    return token;
};

/**
 * Verifies the access token and confirms the backing session is still active.
 *
 * The role is read from the database rather than trusted from the token, so
 * demotions, deletions, and revocations take effect immediately instead of
 * surviving until the access token expires.
 */
export const authMiddleware = asyncHandler(async (req, _res, next) => {
    const token = extractBearerToken(req);
    if (!token) throw ApiError.unauthorized('Authentication required');

    let payload;
    try {
        payload = verifyAccessToken(token);
    } catch (err) {
        const reason = err?.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid access token';
        throw ApiError.unauthorized(reason);
    }

    const session = await getActiveSession(payload.sid);
    if (!session) throw ApiError.unauthorized('Session is no longer active. Please sign in again.');

    req.user = {
        id: session.user_id,
        role: session.role,
        email: session.email,
        fullName: session.full_name,
        sessionId: session.id,
    };

    next();
});

const requireRole = (...roles) =>
    asyncHandler(async (req, _res, next) => {
        if (!req.user) throw ApiError.unauthorized('Authentication required');
        if (!roles.includes(req.user.role)) {
            throw ApiError.forbidden(`Requires ${roles.join(' or ')} privileges`);
        }
        next();
    });

export const adminMiddleware = requireRole('admin');
export const agentMiddleware = requireRole('agent');
export const staffMiddleware = requireRole('admin', 'agent');

export default authMiddleware;
