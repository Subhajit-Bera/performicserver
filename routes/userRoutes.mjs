import { Router } from 'express';
import { getCurrentUser, updateUserProfile, applyToUniversity, bookAppointment } from '../controllers/userController.mjs';
import { authMiddleware } from '../middleware/authMiddleware.mjs';

const router = Router();

router.get('/me', authMiddleware, getCurrentUser);
router.put('/profile', authMiddleware, updateUserProfile);
router.post('/apply', authMiddleware, applyToUniversity);
router.post('/book-appointment', authMiddleware, bookAppointment);

export default router;