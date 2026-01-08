import { Router } from 'express';
import * as complianceController from '../controllers/compliance.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.get('/overview', complianceController.getOverview);
router.get('/users/all', authenticate, requireRole('admin'), complianceController.getAllUsers); // Must come before /users/:id
router.get('/users', authenticate, requireRole('admin'), complianceController.getUsers); // Must come before /users/:id
router.get('/users/:id', authenticate, requireRole('admin'), complianceController.getUserDetails);
router.get('/violations', complianceController.getViolations);
router.get('/trends', complianceController.getTrends);
router.get('/diagnose-overruns', complianceController.diagnoseOverruns);
router.post('/check', complianceController.runComplianceCheck);

export default router;

