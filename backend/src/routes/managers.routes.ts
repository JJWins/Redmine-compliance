import { Router } from 'express';
import * as managersController from '../controllers/managers.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/:id/scorecard', authenticate, managersController.getScorecard);
router.get('/:id/team', authenticate, managersController.getTeamCompliance);

export default router;

