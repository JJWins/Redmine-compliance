import { Router } from 'express';
import * as projectsController from '../controllers/projects.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Health routes must come before /:id route to avoid matching "health" as an ID
router.get('/health/stale-tasks', authenticate, projectsController.getProjectsWithStaleTasks);
router.get('/health/high-spent', authenticate, projectsController.getProjectsWithHighSpentHours);
router.get('/', authenticate, projectsController.getProjects);
router.put('/:id/manager', authenticate, projectsController.updateProjectManager);
router.get('/:id/overruns', authenticate, projectsController.getProjectOverruns);
router.get('/:id', authenticate, projectsController.getProjectDetails);

export default router;

