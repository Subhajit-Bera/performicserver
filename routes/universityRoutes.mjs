import { Router } from 'express';
import { getAllUniversities, getUniversityBySlug } from '../controllers/universityController.mjs';

const router = Router();

router.get('/', getAllUniversities);
router.get('/:slug', getUniversityBySlug);

export default router;