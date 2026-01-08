import { Router } from 'express';
import complianceRoutes from './compliance.routes';
import projectsRoutes from './projects.routes';
import issuesRoutes from './issues.routes';
import managersRoutes from './managers.routes';
import analyticsRoutes from './analytics.routes';
import configRoutes from './config.routes';
import redmineRoutes from './redmine.routes';
import aiRoutes from './ai.routes';
import authRoutes from './auth.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/compliance', complianceRoutes);
router.use('/projects', projectsRoutes);
router.use('/issues', issuesRoutes);
router.use('/managers', managersRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/config', configRoutes);
router.use('/redmine', redmineRoutes);
router.use('/ai', aiRoutes);

export default router;

