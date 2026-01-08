import { Router } from 'express';
import * as configController from '../controllers/config.controller';

const router = Router();

router.get('/', configController.getConfig);
router.get('/compliance-rules', configController.getComplianceRules);
router.put('/compliance-rules', configController.updateComplianceRules);
router.get('/cron-status', configController.getCronStatus);

export default router;

