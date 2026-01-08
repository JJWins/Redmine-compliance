import { Router } from 'express';
import * as redmineController from '../controllers/redmine.controller';

const router = Router();

router.post('/sync', redmineController.triggerSync);
router.get('/status', redmineController.getStatus);

export default router;

