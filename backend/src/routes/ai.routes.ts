import { Router } from 'express';
import * as aiController from '../controllers/ai.controller';

const router = Router();

router.get('/status', aiController.getStatus);
router.get('/settings', aiController.getAISettings);
router.put('/settings', aiController.updateAISettings);
router.get('/insights', aiController.getInsights);
router.get('/report', aiController.generateReport);
router.get('/anomalies', aiController.detectAnomalies);
router.get('/risk', aiController.assessRisk);
router.get('/violations/:violationId/explain', aiController.explainViolation);

export default router;

