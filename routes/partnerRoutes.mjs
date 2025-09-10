import { Router } from 'express';
import { getAllPartners } from '../controllers/partnerController.mjs';

const router = Router();

// GET /api/partners - Fetches all partners for the homepage component
router.get('/', getAllPartners);

export default router;