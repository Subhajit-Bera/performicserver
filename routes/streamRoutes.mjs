import { Router } from 'express';
import { getAllStreams } from '../controllers/adminStreamController.mjs'; // Reusing admin controller

const router = Router();
router.get('/', getAllStreams); // Publicly accessible
export default router;