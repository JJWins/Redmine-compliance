import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller';

const router = Router();

router.get('/patterns', analyticsController.getPatterns);
router.get('/managers', analyticsController.getManagersComparison);

export default router;

