import { Router } from 'express';
import { authMiddleware, agentMiddleware } from '../middleware/authMiddleware.mjs';
import { searchUser, referUser, getMyReferrals } from '../controllers/agentController.mjs';

const router = Router();

// Protect all agent routes
router.use(authMiddleware, agentMiddleware);

router.get('/search-user', searchUser);
router.post('/refer-user', referUser);
router.get('/my-referrals', getMyReferrals);

export default router;