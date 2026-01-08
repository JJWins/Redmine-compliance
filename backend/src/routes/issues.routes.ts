import { Router } from 'express';
import * as issuesController from '../controllers/issues.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, issuesController.getIssues);
router.get('/:id', authenticate, issuesController.getIssueDetails);

export default router;

