import { Router } from 'express';
import { getAllExams, getExamBySlug } from '../controllers/examController.mjs';

const router = Router();

router.get('/', getAllExams);
router.get('/:slug', getExamBySlug);

export default router;