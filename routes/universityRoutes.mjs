import { Router } from 'express';
import { getAllUniversities, getUniversityById } from '../controllers/universityController.mjs';

const router = Router();

router.get('/', getAllUniversities);
router.get('/:id', getUniversityById);

export default router;