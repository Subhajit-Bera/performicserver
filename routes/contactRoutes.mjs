import { Router } from 'express';
import { submitContactMessage } from '../controllers/contactController.mjs';
import { contactLimiter } from '../middleware/rateLimiters.mjs';
import { validate } from '../utils/validate.mjs';
import { contactSchema } from '../schemas/authSchemas.mjs';

const router = Router();

router.post('/', contactLimiter, validate({ body: contactSchema }), submitContactMessage);

export default router;
