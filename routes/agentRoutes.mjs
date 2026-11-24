import { Router } from 'express';
import { authMiddleware, agentMiddleware } from '../middleware/authMiddleware.mjs';
import { searchUser, referUser, getMyReferrals } from '../controllers/agentController.mjs';
import { searchLimiter, writeLimiter } from '../middleware/rateLimiters.mjs';
import { validate } from '../utils/validate.mjs';
import { z } from 'zod';

const searchQuerySchema = z.object({
    q: z.string().trim().min(1).max(120),
});

const referBodySchema = z.preprocess(
    (value) => {
        if (!value || typeof value !== 'object') return value;
        const body = { ...value };
        if (body.userId === undefined && body.user_id !== undefined) body.userId = body.user_id;
        return body;
    },
    z.object({ userId: z.coerce.number().int().positive() })
);

const router = Router();
router.use(authMiddleware, agentMiddleware);

router.get('/search-user', searchLimiter, validate({ query: searchQuerySchema }), searchUser);
router.post('/refer-user', writeLimiter, validate({ body: referBodySchema }), referUser);
router.get('/my-referrals', getMyReferrals);

export default router;
