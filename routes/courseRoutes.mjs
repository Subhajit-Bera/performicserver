import { Router } from 'express';
import { getAllCourses, getCourseBySlug } from '../controllers/courseController.mjs';

const router = Router();

// GET /api/courses - Fetches all courses for the homepage component
router.get('/', getAllCourses);

// GET /api/courses/:slug - Fetches details for a single course and its related universities
router.get('/:slug', getCourseBySlug);

export default router;