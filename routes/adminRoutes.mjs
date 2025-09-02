import { Router } from 'express';
import { getDashboardStats } from '../controllers/adminController.mjs';
import { authMiddleware, adminMiddleware } from '../middleware/authMiddleware.mjs';

const router = Router();

// All routes in this file are protected by auth and admin middleware
router.use(authMiddleware, adminMiddleware);

router.get('/dashboard-stats', getDashboardStats);

export default router;