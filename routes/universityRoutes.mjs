import { Router } from 'express';
import {
    getAllUniversities,
    getUniversityBySlug,
    getTopUniversitiesByStream,
} from '../controllers/universityController.mjs';
import { validate } from '../utils/validate.mjs';
import { universityListQuerySchema } from '../schemas/catalogSchemas.mjs';
import { slugParamSchema } from '../schemas/authSchemas.mjs';

const router = Router();

router.get('/top-by-stream', getTopUniversitiesByStream);
router.get('/', validate({ query: universityListQuerySchema }), getAllUniversities);
router.get('/:slug', validate({ params: slugParamSchema }), getUniversityBySlug);

export default router;
