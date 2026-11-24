import { Router } from 'express';
import {
    getCurrentUser,
    updateUserProfile,
    applyToUniversity,
    bookAppointment,
    getUserAppointments,
    cancelAppointment,
    getUserApplications,
} from '../controllers/userController.mjs';
import { authMiddleware } from '../middleware/authMiddleware.mjs';
import { writeLimiter } from '../middleware/rateLimiters.mjs';
import { validate } from '../utils/validate.mjs';
import {
    profileUpdateSchema,
    applySchema,
    bookAppointmentSchema,
    idParamSchema,
} from '../schemas/authSchemas.mjs';

const router = Router();
router.use(authMiddleware);

router.get('/me', getCurrentUser);
router.put('/profile', writeLimiter, validate({ body: profileUpdateSchema }), updateUserProfile);
router.post('/apply', writeLimiter, validate({ body: applySchema }), applyToUniversity);
router.get('/applications', getUserApplications);

router.post('/book-appointment', writeLimiter, validate({ body: bookAppointmentSchema }), bookAppointment);
router.get('/appointments', getUserAppointments);
router.put('/appointments/:id/cancel', writeLimiter, validate({ params: idParamSchema }), cancelAppointment);

export default router;
