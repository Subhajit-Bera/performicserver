import { Router } from 'express';
import { getAllUniversities, getUniversityBySlug,getTopUniversitiesByStream } from '../controllers/universityController.mjs';

const router = Router();
router.get('/top-by-stream', getTopUniversitiesByStream);
router.get('/', getAllUniversities);
router.get('/:slug', getUniversityBySlug);

export default router;