import prisma from '../config/database';
import redmineService from './redmine.service';
import syncStateService from './sync-state.service';
import { logIncomingData, logBatchData } from '../utils/logger';
import logger from '../utils/logger';

class SyncService {
  /**
   * Sync all users from Redmine
   * @param incremental - If true, only syncs users created/updated after last_sync
   */
  async syncUsers(incremental: boolean = false): Promise<{ synced: number; errors: number }> {
    let synced = 0;
    let errors = 0;

    try {
      let lastSync: Date | null = null;
      if (incremental) {
        lastSync = await syncStateService.getLastSyncTime('users');
        if (lastSync) {
          logger.info('Starting incremental users sync', { lastSync: lastSync.toISOString() });
        } else {
          logger.info('Starting users sync (no previous sync found, doing full sync)');
        }
      } else {
        logger.info('Starting full users sync (all users)');
      }

      const users = await redmineService.fetchUsers();
      logger.info('Fetched users from Redmine', { count: users.length });

      // Log batch of users received
      logBatchData('redmine-api', 'user', users, {
        syncType: incremental ? 'incremental' : 'full',
        totalCount: users.length
      });

      // Filter by timestamp if incremental
      let usersToSync = users;
      if (incremental && lastSync) {
        usersToSync = users.filter(user => {
          const createdOn = new Date(user.created_on);
          const updatedOn = user.updated_on ? new Date(user.updated_on) : createdOn;
          // Include if created or updated after last sync
          return createdOn >= lastSync! || updatedOn >= lastSync!;
        });
        logger.info('Filtered users to sync', { count: usersToSync.length, reason: 'created/updated after last sync' });
      }

      for (const redmineUser of usersToSync) {
        try {
          // Log individual user data for inspection
          logIncomingData('sync-service', 'user', redmineUser, {
            syncType: incremental ? 'incremental' : 'full',
            redmineUserId: redmineUser.id
          });

          const fullName = `${redmineUser.firstname} ${redmineUser.lastname}`.trim();

          // Map Redmine timestamps
          const createdOn = new Date(redmineUser.created_on);
          const updatedOn = redmineUser.updated_on ? new Date(redmineUser.updated_on) : createdOn;

          // Check if user exists
          const existingUser = await prisma.user.findUnique({
            where: { redmineUserId: redmineUser.id },
          });

          if (existingUser) {
            // Update existing user - use raw query to bypass @updatedAt decorator
            await prisma.$executeRaw`
              UPDATE users 
              SET name = ${fullName},
                  email = ${redmineUser.mail},
                  status = ${redmineUser.status},
                  updated_at = ${updatedOn},
                  last_synced_at = ${new Date()}
              WHERE redmine_user_id = ${redmineUser.id}
            `;
          } else {
            // Create new user
            await prisma.user.create({
              data: {
                redmineUserId: redmineUser.id,
                name: fullName,
                email: redmineUser.mail,
                status: redmineUser.status, // Redmine user status: 1 = Active, 2 = Registered, 3 = Locked
                createdAt: createdOn, // Use Redmine's created_on
                updatedAt: updatedOn, // Use Redmine's updated_on (or created_on if not available)
                lastSyncedAt: new Date(),
              },
            });
          }

          synced++;
        } catch (error: any) {
          logger.error('Error syncing user', { userId: redmineUser.id, error: error.message });
          errors++;
        }
      }

      logger.info('Users sync complete', { synced, errors });
      
      // For full sync (not incremental), detect and remove deleted users
      if (!incremental) {
        logger.info('Checking for deleted users in Redmine (full sync)');
        
        // Get all Redmine user IDs that were fetched
        const redmineUserIds = new Set(users.map(user => user.id));
        logger.info('Redmine users fetched', { 
          totalFetched: users.length,
          uniqueRedmineIds: redmineUserIds.size
        });
        
        // Find users in database that don't exist in Redmine anymore
        const allDbUsers = await prisma.user.findMany({
          // All users have a non-null redmineUserId (schema enforces Int, not nullable)
          // so we don't need a `not: null` filter here (which Prisma rejects for non-nullable fields)
          select: {
            id: true,
            redmineUserId: true,
            name: true,
            email: true
          }
        });
        
        logger.info('Database users found', { totalInDb: allDbUsers.length });
        
        const deletedUsers = allDbUsers.filter(dbUser => 
          dbUser.redmineUserId && !redmineUserIds.has(dbUser.redmineUserId)
        );
        
        if (deletedUsers.length > 0) {
          logger.info('Found deleted users in Redmine', { 
            count: deletedUsers.length,
            sampleDeleted: deletedUsers.slice(0, 10).map(u => ({ 
              redmineId: u.redmineUserId, 
              name: u.name,
              email: u.email
            }))
          });
          
          // Mark users as inactive instead of deleting (to preserve historical data)
          // Or delete if they have no critical related records
          const deletedIds = deletedUsers.map(user => user.id);
          
          // Check if users have related records that prevent deletion
          // Check multiple foreign key relationships:
          const [usersWithTimeEntries, usersWithIssues, usersWithViolations, usersWithScorecards, usersAsManagers, usersInProjects] = await Promise.all([
            prisma.timeEntry.findMany({
              where: { userId: { in: deletedIds } },
              select: { userId: true },
              distinct: ['userId']
            }),
            prisma.issue.findMany({
              where: { assignedToId: { in: deletedIds } },
              select: { assignedToId: true },
              distinct: ['assignedToId']
            }),
            prisma.complianceViolation.findMany({
              where: { userId: { in: deletedIds } },
              select: { userId: true },
              distinct: ['userId']
            }),
            prisma.managerScorecard.findMany({
              where: { managerId: { in: deletedIds } },
              select: { managerId: true },
              distinct: ['managerId']
            }),
            prisma.user.findMany({
              where: { managerId: { in: deletedIds } },
              select: { managerId: true },
              distinct: ['managerId']
            }),
            prisma.project.findMany({
              where: { managerId: { in: deletedIds } },
              select: { managerId: true },
              distinct: ['managerId']
            })
          ]);
          
          // Collect all user IDs that have any related records
          const usersWithRelations = new Set([
            ...usersWithTimeEntries.map(te => te.userId),
            ...usersWithIssues.map(i => i.assignedToId).filter(Boolean),
            ...usersWithViolations.map(v => v.userId),
            ...usersWithScorecards.map(s => s.managerId),
            ...usersAsManagers.map(u => u.managerId).filter(Boolean),
            ...usersInProjects.map(p => p.managerId).filter(Boolean)
          ]);
          
          // Mark as inactive if they have related records, otherwise delete
          const usersToDeactivate = deletedIds.filter(id => usersWithRelations.has(id));
          const usersToDelete = deletedIds.filter(id => !usersWithRelations.has(id));
          
          if (usersToDeactivate.length > 0) {
            // Mark deleted users as Locked (status 3) instead of deleting
            const deactivateResult = await prisma.user.updateMany({
              where: {
                id: { in: usersToDeactivate }
              },
              data: {
                status: 3 // Locked status for users deleted from Redmine
              }
            });
            logger.info('Marked deleted users as Locked (preserving historical data)', { 
              deactivatedCount: deactivateResult.count,
              userIds: usersToDeactivate
            });
          }
          
          if (usersToDelete.length > 0) {
            const deleteResult = await prisma.user.deleteMany({
              where: {
                id: { in: usersToDelete }
              }
            });
            logger.info('Deleted users removed from database', { 
              deletedCount: deleteResult.count,
              deletedUserIds: deletedUsers
                .filter(u => usersToDelete.includes(u.id))
                .map(u => u.redmineUserId)
            });
          }
        } else {
          logger.info('No deleted users found - all database users exist in Redmine');
        }
      } else {
        logger.info('Skipping deleted users check', { reason: 'incremental sync' });
      }
      
      // Update last sync time
      if (synced > 0) {
        await syncStateService.updateLastSyncTime('users');
      }
      
      return { synced, errors };
    } catch (error: any) {
      if (error.response?.status === 403) {
        logger.warn('Users endpoint requires additional permissions. Skipping users sync.', {
          message: 'You may need to grant "View users" permission to your API key.'
        });
        return { synced: 0, errors: 0 }; // Don't fail the whole sync
      }
      logger.error('Error in users sync', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Sync all projects from Redmine
   * @param incremental - If true, only syncs projects updated after last_sync
   */
  async syncProjects(incremental: boolean = false): Promise<{ synced: number; errors: number }> {
    let synced = 0;
    let errors = 0;

    try {
      let lastSync: Date | null = null;
      if (incremental) {
        lastSync = await syncStateService.getLastSyncTime('projects');
        if (lastSync) {
          logger.info('Starting incremental projects sync', { lastSync: lastSync.toISOString() });
        } else {
          logger.info('Starting projects sync (no previous sync found, doing full sync)');
        }
      } else {
        logger.info('Starting full projects sync (all projects)');
      }

      const projects = await redmineService.fetchProjects();
      logger.info('Fetched projects from Redmine', { count: projects.length });

      // Log batch of projects received
      logBatchData('redmine-api', 'project', projects, {
        syncType: incremental ? 'incremental' : 'full',
        totalCount: projects.length
      });

      // Filter by timestamp if incremental
      let projectsToSync = projects;
      if (incremental && lastSync) {
        projectsToSync = projects.filter(project => {
          const updatedOn = new Date(project.updated_on);
          const createdOn = new Date(project.created_on);
          // Include if created or updated after last sync
          return createdOn >= lastSync! || updatedOn >= lastSync!;
        });
        logger.info('Filtered projects to sync', { count: projectsToSync.length, reason: 'updated after last sync' });
      }

      for (const redmineProject of projectsToSync) {
        try {
          // Log individual project data for inspection
          logIncomingData('sync-service', 'project', redmineProject, {
            syncType: incremental ? 'incremental' : 'full',
            redmineProjectId: redmineProject.id
          });

          // Map Redmine status to our enum
          let status: 'active' | 'archived' | 'closed' = 'active';
          if (redmineProject.status === 5) {
            status = 'closed';
          } else if (redmineProject.status === 9) {
            status = 'archived';
          }

          // Find parent project if exists
          let parentProjectId: string | undefined;
          if (redmineProject.parent?.id) {
            const parentProject = await prisma.project.findUnique({
              where: { redmineProjectId: redmineProject.parent.id },
            });
            parentProjectId = parentProject?.id;
          }

          // Map Redmine timestamps
          const createdOn = new Date(redmineProject.created_on);
          const updatedOn = new Date(redmineProject.updated_on);

          // Check if project exists
          const existingProject = await prisma.project.findUnique({
            where: { redmineProjectId: redmineProject.id },
          });

          // Try to find manager from Redmine project details
          // Only fetch if project doesn't have a manager yet (to avoid unnecessary API calls)
          let managerId: string | null = existingProject?.managerId || null;
          
          if (!managerId) {
            // Try to get manager from Redmine project details
            // Add small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const projectDetails = await redmineService.fetchProjectDetails(redmineProject.id);
            
            if (projectDetails) {
              // Check for manager in custom fields (common Redmine pattern)
              if (projectDetails.custom_fields && Array.isArray(projectDetails.custom_fields)) {
                const managerField = projectDetails.custom_fields.find((field: any) => 
                  field.name?.toLowerCase().includes('manager') || 
                  field.name?.toLowerCase().includes('pm') ||
                  field.name?.toLowerCase().includes('project manager')
                );
                
                if (managerField?.value) {
                  // Try to find user by name or email from custom field
                  const managerName = String(managerField.value).trim();
                  if (managerName) {
                    // Search for manager by name or email
                    const manager = await prisma.user.findFirst({
                      where: {
                        OR: [
                          { name: { contains: managerName } },
                          { email: { contains: managerName } }
                        ],
                        role: { in: ['manager', 'admin'] }
                      }
                    });
                    
                    if (manager) {
                      managerId = manager.id;
                      logger.info('Found manager from custom field', {
                        projectId: redmineProject.id,
                        projectName: redmineProject.name,
                        managerName,
                        managerId: manager.id,
                        managerEmail: manager.email
                      });
                    }
                  }
                }
              }

              // If still no manager, try to inherit from parent project
              if (!managerId && parentProjectId) {
                const parentProject = await prisma.project.findUnique({
                  where: { id: parentProjectId },
                  select: { managerId: true }
                });
                
                if (parentProject?.managerId) {
                  managerId = parentProject.managerId;
                  logger.info('Inherited manager from parent project', {
                    projectId: redmineProject.id,
                    projectName: redmineProject.name,
                    parentProjectId,
                    managerId
                  });
                }
              }
            }
          }

          if (existingProject) {
            // Update existing project - update manager_id if we found one
            await prisma.$executeRaw`
              UPDATE projects 
              SET name = ${redmineProject.name},
                  parent_id = ${parentProjectId || null},
                  manager_id = ${managerId || null},
                  status = ${status},
                  updated_at = ${updatedOn},
                  last_synced_at = ${new Date()}
              WHERE redmine_project_id = ${redmineProject.id}
            `;
            
            if (managerId && !existingProject.managerId) {
              logger.info('Assigned manager during sync', {
                projectId: redmineProject.id,
                projectName: redmineProject.name,
                managerId
              });
            }
          } else {
            // Create new project
            await prisma.project.create({
              data: {
                redmineProjectId: redmineProject.id,
                name: redmineProject.name,
                parentId: parentProjectId,
                status,
                managerId: managerId, // Assign manager if found
                createdAt: createdOn, // Use Redmine's created_on
                updatedAt: updatedOn, // Use Redmine's updated_on
                lastSyncedAt: new Date(),
              },
            });
            
            if (managerId) {
              logger.info('Created project with manager assigned', {
                projectId: redmineProject.id,
                projectName: redmineProject.name,
                managerId
              });
            }
          }

          synced++;
        } catch (error: any) {
          logger.error('Error syncing project', { projectId: redmineProject.id, error: error.message });
          errors++;
        }
      }

      logger.info('Projects sync complete', { synced, errors });
      
      // For full sync (not incremental), detect and remove deleted projects
      if (!incremental) {
        logger.info('Checking for deleted projects in Redmine (full sync)');
        
        // Get all Redmine project IDs that were fetched
        const redmineProjectIds = new Set(projects.map(project => project.id));
        logger.info('Redmine projects fetched', { 
          totalFetched: projects.length,
          uniqueRedmineIds: redmineProjectIds.size
        });
        
        // Find projects in database that don't exist in Redmine anymore
        const allDbProjects = await prisma.project.findMany({
          select: {
            id: true,
            redmineProjectId: true,
            name: true
          }
        });
        
        logger.info('Database projects found', { totalInDb: allDbProjects.length });
        
        const deletedProjects = allDbProjects.filter(dbProject => 
          !redmineProjectIds.has(dbProject.redmineProjectId)
        );
        
        if (deletedProjects.length > 0) {
          logger.info('Found deleted projects in Redmine', { 
            count: deletedProjects.length,
            sampleDeleted: deletedProjects.slice(0, 10).map(p => ({ 
              redmineId: p.redmineProjectId, 
              name: p.name
            }))
          });
          
          // Delete projects that no longer exist in Redmine
          const deletedIds = deletedProjects.map(project => project.id);
          
          // First, delete related issues (which will cascade to time entries via foreign key)
          const issuesDeleted = await prisma.issue.deleteMany({
            where: {
              projectId: { in: deletedIds }
            }
          });
          
          if (issuesDeleted.count > 0) {
            logger.info('Deleted related issues for deleted projects', { count: issuesDeleted.count });
          }
          
          // Delete time entries directly linked to projects (without issues)
          const timeEntriesDeleted = await prisma.timeEntry.deleteMany({
            where: {
              projectId: { in: deletedIds },
              issueId: null
            }
          });
          
          if (timeEntriesDeleted.count > 0) {
            logger.info('Deleted related time entries for deleted projects', { count: timeEntriesDeleted.count });
          }
          
          // Delete the projects
          const deleteResult = await prisma.project.deleteMany({
            where: {
              id: { in: deletedIds }
            }
          });
          
          logger.info('Deleted projects removed from database', { 
            deletedCount: deleteResult.count,
            deletedProjectIds: deletedProjects.map(p => p.redmineProjectId),
            relatedIssuesDeleted: issuesDeleted.count,
            relatedTimeEntriesDeleted: timeEntriesDeleted.count
          });
        } else {
          logger.info('No deleted projects found - all database projects exist in Redmine');
        }
      } else {
        logger.info('Skipping deleted projects check', { reason: 'incremental sync' });
      }
      
      // Update last sync time
      if (synced > 0) {
        await syncStateService.updateLastSyncTime('projects');
      }
      
      return { synced, errors };
    } catch (error: any) {
      logger.error('Error in projects sync', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Sync issues from Redmine
   * Optimized with batch processing for large datasets
   * @param projectId - Optional project filter
   * @param updatedAfter - Optional date filter (for incremental sync)
   * @param incremental - If true, uses last_synced_at from sync state and API filter
   */
  async syncIssues(projectId?: number, updatedAfter?: Date, incremental: boolean = false): Promise<{ synced: number; errors: number }> {
    let synced = 0;
    let errors = 0;

    try {
      // For incremental sync, get last sync time and use API filter
      if (incremental && !updatedAfter) {
        const lastSync = await syncStateService.getLastSyncTime('issues');
        if (lastSync) {
          updatedAfter = lastSync;
          logger.info('Starting incremental issues sync', { lastSync: lastSync.toISOString() });
        } else {
          logger.info('Starting issues sync (no previous sync found, doing full sync)');
        }
      } else if (!incremental && !updatedAfter) {
        logger.info('Starting full issues sync (all issues)');
        logger.warn('This may take a while for large datasets');
      } else {
        logger.info('Starting issues sync', { updatedAfter: updatedAfter?.toISOString() });
      }

      const issues = await redmineService.fetchIssues(projectId, updatedAfter);
      logger.info('Fetched issues from Redmine', { count: issues.length });

      // Log batch of issues received
      if (issues.length > 0) {
        logBatchData('redmine-api', 'issue', issues, {
          syncType: incremental ? 'incremental' : 'full',
          totalCount: issues.length,
          projectId: projectId || 'all'
        });
      }

      if (issues.length === 0) {
        logger.info('No issues fetched from Redmine');
        
        // For full sync, if no issues were fetched, we should still check for deleted issues
        // This handles the case where all issues might have been deleted in Redmine
        if (!incremental && !updatedAfter && !projectId) {
          logger.info('No issues in Redmine - checking if all database issues should be deleted');
          
          const allDbIssues = await prisma.issue.findMany({
            select: {
              id: true,
              redmineIssueId: true,
              subject: true
            }
          });
          
          if (allDbIssues.length > 0) {
            logger.warn('Redmine has no issues but database has issues', { 
              dbIssueCount: allDbIssues.length,
              action: 'Not deleting - this might indicate a Redmine API issue. Please verify manually.'
            });
            // Don't auto-delete in this case - it might be an API issue
            // User should verify manually if Redmine truly has no issues
          }
        }
        
        return { synced: 0, errors: 0 };
      }

      // Batch processing for large datasets
      const batchSize = 50;
      const totalBatches = Math.ceil(issues.length / batchSize);
      
      logger.info('Processing issues in batches', { total: issues.length, batches: totalBatches, batchSize });

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batch = issues.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize);
        
        // Process batch in parallel
        const batchPromises = batch.map(async (redmineIssue) => {
          // Log individual issue data for inspection
          logIncomingData('sync-service', 'issue', redmineIssue, {
            syncType: incremental ? 'incremental' : 'full',
            redmineIssueId: redmineIssue.id,
            batchIndex,
            batchSize: batch.length
          });
          try {
            // Find project in our database
            const project = await prisma.project.findUnique({
              where: { redmineProjectId: redmineIssue.project.id },
            });

            if (!project) {
              return { success: false, reason: `Project ${redmineIssue.project.id} not found` };
            }

            // Find assigned user if exists
            let assignedUserId: string | undefined;
            if (redmineIssue.assigned_to) {
              const assignedUser = await prisma.user.findUnique({
                where: { redmineUserId: redmineIssue.assigned_to.id },
              });
              assignedUserId = assignedUser?.id;
            }

            // Map Redmine timestamps
            const createdOn = new Date(redmineIssue.created_on);
            const updatedOn = new Date(redmineIssue.updated_on);

            // Check if issue exists
            const existingIssue = await prisma.issue.findUnique({
              where: { redmineIssueId: redmineIssue.id },
            });

            if (existingIssue) {
              // Update existing issue - use raw query to bypass @updatedAt decorator
              await prisma.$executeRaw`
                UPDATE issues 
                SET project_id = ${project.id},
                    assigned_to_id = ${assignedUserId || null},
                    subject = ${redmineIssue.subject},
                    estimated_hours = ${redmineIssue.estimated_hours ? parseFloat(redmineIssue.estimated_hours.toString()) : null},
                    due_date = ${redmineIssue.due_date ? new Date(redmineIssue.due_date) : null},
                    status = ${redmineIssue.status.name},
                    updated_at = ${updatedOn},
                    created_at = ${createdOn},
                    last_synced_at = ${new Date()}
                WHERE redmine_issue_id = ${redmineIssue.id}
              `;
            } else {
              // Create new issue
              await prisma.issue.create({
                data: {
                  redmineIssueId: redmineIssue.id,
                  projectId: project.id,
                  assignedToId: assignedUserId,
                  subject: redmineIssue.subject,
                  estimatedHours: redmineIssue.estimated_hours ? parseFloat(redmineIssue.estimated_hours.toString()) : null,
                  dueDate: redmineIssue.due_date ? new Date(redmineIssue.due_date) : null,
                  status: redmineIssue.status.name,
                  createdAt: createdOn, // Use Redmine's created_on
                  updatedAt: updatedOn, // Use Redmine's updated_on
                  lastSyncedAt: new Date(),
                },
              });
            }

            return { success: true };
          } catch (error: any) {
            return { success: false, reason: error.message };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach((result) => {
          if (result.success) {
            synced++;
          } else {
            errors++;
            if (errors <= 10) { // Only log first 10 errors
              logger.warn('Issue sync error', { reason: result.reason });
            }
          }
        });

        // Log progress
        const processed = (batchIndex + 1) * batchSize;
        if (processed % 500 === 0 || batchIndex === totalBatches - 1) {
          logger.info('Issues sync progress', {
            processed: Math.min(processed, issues.length),
            total: issues.length,
            synced,
            errors
          });
        }
      }

      logger.info('Issues sync complete', { synced, errors });
      
      // For full sync (not incremental), detect and remove deleted issues
      // Only do this if we fetched all issues (no projectId filter and no updatedAfter filter)
      if (!incremental && !updatedAfter && !projectId) {
        logger.info('Checking for deleted issues in Redmine (full sync, all projects)');
        
        // Get all Redmine issue IDs that were fetched
        const redmineIssueIds = new Set(issues.map(issue => issue.id));
        
        // Find issues in database that don't exist in Redmine anymore
        const allDbIssues = await prisma.issue.findMany({
          select: {
            id: true,
            redmineIssueId: true,
            subject: true
          }
        });
        
        const deletedIssues = allDbIssues.filter(dbIssue => !redmineIssueIds.has(dbIssue.redmineIssueId));
        
        if (deletedIssues.length > 0) {
          logger.info('Found deleted issues in Redmine', { 
            count: deletedIssues.length,
            sampleDeleted: deletedIssues.slice(0, 10).map(i => ({ 
              redmineId: i.redmineIssueId, 
              subject: i.subject 
            }))
          });
          
          // Delete issues that no longer exist in Redmine
          const deletedIds = deletedIssues.map(issue => issue.id);
          
          // First, delete related time entries (if any) to maintain referential integrity
          const timeEntriesDeleted = await prisma.timeEntry.deleteMany({
            where: {
              issueId: { in: deletedIds }
            }
          });
          
          if (timeEntriesDeleted.count > 0) {
            logger.info('Deleted related time entries for deleted issues', { count: timeEntriesDeleted.count });
          }
          
          // Delete the issues
          const deleteResult = await prisma.issue.deleteMany({
            where: {
              id: { in: deletedIds }
            }
          });
          
          logger.info('Deleted issues removed from database', { 
            deletedCount: deleteResult.count,
            deletedIssueIds: deletedIssues.map(i => i.redmineIssueId),
            relatedTimeEntriesDeleted: timeEntriesDeleted.count
          });
        } else {
          logger.info('No deleted issues found - all database issues exist in Redmine');
        }
      } else if (!incremental && !updatedAfter && projectId) {
        // For project-specific full sync, only check issues in that project
        logger.info('Checking for deleted issues in project', { projectId });
        
        // Get the project from database
        const project = await prisma.project.findUnique({
          where: { redmineProjectId: projectId },
          select: { id: true }
        });
        
        if (project) {
          // Get all Redmine issue IDs that were fetched for this project
          const redmineIssueIds = new Set(issues.map(issue => issue.id));
          
          // Find issues in database for this project that don't exist in Redmine anymore
          const projectDbIssues = await prisma.issue.findMany({
            where: { projectId: project.id },
            select: {
              id: true,
              redmineIssueId: true,
              subject: true
            }
          });
          
          const deletedIssues = projectDbIssues.filter(dbIssue => !redmineIssueIds.has(dbIssue.redmineIssueId));
          
          if (deletedIssues.length > 0) {
            logger.info('Found deleted issues in project', { 
              projectId, 
              count: deletedIssues.length,
              sampleDeleted: deletedIssues.slice(0, 10).map(i => ({ 
                redmineId: i.redmineIssueId, 
                subject: i.subject 
              }))
            });
            
            // Delete issues that no longer exist in Redmine
            const deletedIds = deletedIssues.map(issue => issue.id);
            
            // First, delete related time entries (if any)
            const timeEntriesDeleted = await prisma.timeEntry.deleteMany({
              where: {
                issueId: { in: deletedIds }
              }
            });
            
            if (timeEntriesDeleted.count > 0) {
              logger.info('Deleted related time entries', { count: timeEntriesDeleted.count });
            }
            
            // Delete the issues
            const deleteResult = await prisma.issue.deleteMany({
              where: {
                id: { in: deletedIds }
              }
            });
            
            logger.info('Deleted issues removed from database', { 
              deletedCount: deleteResult.count,
              deletedIssueIds: deletedIssues.map(i => i.redmineIssueId),
              projectId,
              relatedTimeEntriesDeleted: timeEntriesDeleted.count
            });
          } else {
            logger.info('No deleted issues found in project', { projectId });
          }
        }
      } else {
        logger.info('Skipping deleted issues check', { 
          reason: incremental ? 'incremental sync' : updatedAfter ? 'date filter applied' : 'project filter applied'
        });
      }
      
      // Update last sync time
      if (synced > 0) {
        await syncStateService.updateLastSyncTime('issues');
      }
      
      return { synced, errors };
    } catch (error: any) {
      logger.error('Error in issues sync', { error: error.message, stack: error.stack });
      // Don't throw - return partial results
      if (synced > 0) {
        logger.warn('Partial sync completed', { synced, message: 'Some issues synced before error' });
        await syncStateService.updateLastSyncTime('issues'); // Update even on partial success
        return { synced, errors };
      }
      throw error;
    }
  }

  /**
   * Sync time entries from Redmine
   * Optimized for large datasets (lakhs of records)
   * @param spentAfter - Filter by spent_on date (for incremental sync)
   * @param spentBefore - Optional end date filter
   * @param incremental - If true, uses last_synced_at from sync state
   * @param daysBack - For full sync, how many days back to fetch (default 90, can extend)
   */
  async syncTimeEntries(spentAfter?: Date, spentBefore?: Date, incremental: boolean = false, daysBack: number = 90): Promise<{ synced: number; errors: number }> {
    let synced = 0;
    let errors = 0;

    try {
      // For incremental sync, get last sync time and use API filter
      if (incremental && !spentAfter) {
        const lastSync = await syncStateService.getLastSyncTime('timeEntries');
        if (lastSync) {
          // Use updated_on for incremental (more reliable than spent_on for catching updates)
          // But also include 7 days buffer to catch any late entries
          spentAfter = new Date(lastSync);
          spentAfter.setDate(spentAfter.getDate() - 7);
          logger.info('Starting incremental time entries sync', { spentAfter: spentAfter.toISOString() });
        } else {
          // No previous sync, default to last 90 days for initial incremental
          spentAfter = new Date();
          spentAfter.setDate(spentAfter.getDate() - 90);
          logger.info('Starting time entries sync (no previous sync, using last 90 days)');
        }
      } else if (!incremental && !spentAfter) {
        logger.info('Starting full time entries sync', { daysBack });
        logger.warn('This may take a while for large datasets (lakhs of records)');
        // For full sync, use daysBack parameter (default 90, can extend)
        spentAfter = new Date();
        spentAfter.setDate(spentAfter.getDate() - daysBack);
      } else {
        logger.info('Starting time entries sync', { spentAfter: spentAfter?.toISOString() });
      }

      const timeEntries = await redmineService.fetchTimeEntries(undefined, undefined, spentAfter, spentBefore);
      logger.info('Fetched time entries from Redmine', { count: timeEntries.length });
      
      // Log batch of time entries received (sample first 100 to avoid huge logs)
      if (timeEntries.length > 0) {
        const sampleSize = Math.min(100, timeEntries.length);
        logBatchData('redmine-api', 'timeEntry', timeEntries.slice(0, sampleSize), {
          syncType: incremental ? 'incremental' : 'full',
          totalCount: timeEntries.length,
          sampleSize,
          dateRange: {
            from: spentAfter?.toISOString(),
            to: spentBefore?.toISOString()
          }
        });
      }
      
      if (timeEntries.length === 0) {
        logger.info('No time entries to sync');
        return { synced: 0, errors: 0 };
      }

      // Batch processing for large datasets
      const batchSize = 100;
      const totalBatches = Math.ceil(timeEntries.length / batchSize);
      
      logger.info('Processing time entries in batches', { total: timeEntries.length, batches: totalBatches, batchSize });

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batch = timeEntries.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize);
        
        // Process batch in parallel
        const batchPromises = batch.map(async (redmineEntry) => {
          // Log individual time entry data for inspection (sample every 10th entry to avoid log spam)
          if (batchIndex * batchSize + batch.indexOf(redmineEntry) % 10 === 0) {
            logIncomingData('sync-service', 'timeEntry', redmineEntry, {
              syncType: incremental ? 'incremental' : 'full',
              redmineTimeEntryId: redmineEntry.id,
              batchIndex,
              batchSize: batch.length
            });
          }
          try {
            // Find user in our database
            const user = await prisma.user.findUnique({
              where: { redmineUserId: redmineEntry.user.id },
            });

            if (!user) {
              return { success: false, reason: `User ${redmineEntry.user.id} not found` };
            }

            // Find project in our database
            const project = await prisma.project.findUnique({
              where: { redmineProjectId: redmineEntry.project.id },
            });

            if (!project) {
              return { success: false, reason: `Project ${redmineEntry.project.id} not found` };
            }

            // Find issue if exists
            let issueId: string | undefined;
            if (redmineEntry.issue) {
              const issue = await prisma.issue.findUnique({
                where: { redmineIssueId: redmineEntry.issue.id },
              });
              issueId = issue?.id;
            }

            // Map Redmine timestamps
            const createdOn = new Date(redmineEntry.created_on);
            const updatedOn = new Date(redmineEntry.updated_on);

            // Check if time entry exists
            const existingEntry = await prisma.timeEntry.findUnique({
              where: { redmineTimeEntryId: redmineEntry.id },
            });

            if (existingEntry) {
              // Update existing time entry - use raw query to bypass @updatedAt decorator
              await prisma.$executeRaw`
                UPDATE time_entries 
                SET user_id = ${user.id},
                    project_id = ${project.id},
                    issue_id = ${issueId || null},
                    hours = ${parseFloat(redmineEntry.hours.toString())},
                    spent_on = ${new Date(redmineEntry.spent_on)},
                    created_on = ${createdOn},
                    updated_at = ${updatedOn},
                    comments = ${redmineEntry.comments || null}
                WHERE redmine_time_entry_id = ${redmineEntry.id}
              `;
            } else {
              // Create new time entry
              await prisma.timeEntry.create({
                data: {
                  redmineTimeEntryId: redmineEntry.id,
                  userId: user.id,
                  projectId: project.id,
                  issueId,
                  hours: parseFloat(redmineEntry.hours.toString()),
                  spentOn: new Date(redmineEntry.spent_on),
                  createdOn: createdOn, // Use Redmine's created_on
                  createdAt: createdOn, // Also set createdAt to Redmine's created_on
                  updatedAt: updatedOn, // Use Redmine's updated_on
                  comments: redmineEntry.comments || null,
                },
              });
            }

            return { success: true };
          } catch (error: any) {
            return { success: false, reason: error.message };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach((result) => {
          if (result.success) {
            synced++;
          } else {
            errors++;
            if (errors <= 10) { // Only log first 10 errors to avoid spam
              logger.warn('Time entry sync error', { reason: result.reason });
            }
          }
        });

        // Log progress
        const processed = (batchIndex + 1) * batchSize;
        if (processed % 1000 === 0 || batchIndex === totalBatches - 1) {
          logger.info('Time entries sync progress', {
            processed: Math.min(processed, timeEntries.length),
            total: timeEntries.length,
            synced,
            errors
          });
        }
      }

      logger.info('Time entries sync complete', { synced, errors });
      
      // For full sync (not incremental), detect and remove deleted time entries
      // Only check time entries in the date range that was synced
      if (!incremental && spentAfter) {
        logger.info('Checking for deleted time entries in Redmine (full sync)', {
          dateRange: {
            from: spentAfter.toISOString(),
            to: spentBefore?.toISOString() || 'now'
          }
        });
        
        // Get all Redmine time entry IDs that were fetched
        const redmineTimeEntryIds = new Set(timeEntries.map(entry => entry.id));
        logger.info('Redmine time entries fetched', { 
          totalFetched: timeEntries.length,
          uniqueRedmineIds: redmineTimeEntryIds.size
        });
        
        // Find time entries in database within the date range that don't exist in Redmine anymore
        const whereClause: any = {
          spentOn: { gte: spentAfter }
        };
        if (spentBefore) {
          whereClause.spentOn.lte = spentBefore;
        }
        
        const dbTimeEntriesInRange = await prisma.timeEntry.findMany({
          where: whereClause,
          select: {
            id: true,
            redmineTimeEntryId: true,
            spentOn: true,
            hours: true
          }
        });
        
        logger.info('Database time entries in date range found', { totalInDb: dbTimeEntriesInRange.length });
        
        const deletedTimeEntries = dbTimeEntriesInRange.filter(dbEntry => 
          dbEntry.redmineTimeEntryId && !redmineTimeEntryIds.has(dbEntry.redmineTimeEntryId)
        );
        
        if (deletedTimeEntries.length > 0) {
          logger.info('Found deleted time entries in Redmine', { 
            count: deletedTimeEntries.length,
            sampleDeleted: deletedTimeEntries.slice(0, 10).map(te => ({ 
              redmineId: te.redmineTimeEntryId, 
              spentOn: te.spentOn,
              hours: te.hours
            }))
          });
          
          // Delete time entries that no longer exist in Redmine
          const deletedIds = deletedTimeEntries.map(entry => entry.id);
          const deleteResult = await prisma.timeEntry.deleteMany({
            where: {
              id: { in: deletedIds }
            }
          });
          
          logger.info('Deleted time entries removed from database', { 
            deletedCount: deleteResult.count,
            deletedTimeEntryIds: deletedTimeEntries.map(te => te.redmineTimeEntryId)
          });
        } else {
          logger.info('No deleted time entries found in date range - all database time entries exist in Redmine');
        }
      } else {
        logger.info('Skipping deleted time entries check', { 
          reason: incremental ? 'incremental sync' : 'no date range specified'
        });
      }
      
      // Update last sync time
      if (synced > 0) {
        await syncStateService.updateLastSyncTime('timeEntries');
      }
      
      return { synced, errors };
    } catch (error: any) {
      logger.error('Error in time entries sync', { error: error.message, stack: error.stack });
      // Update sync time even on partial success
      if (synced > 0) {
        await syncStateService.updateLastSyncTime('timeEntries');
        logger.warn('Partial sync completed', { synced, message: 'Some time entries synced before error' });
        return { synced, errors };
      }
      throw error;
    }
  }

  /**
   * Sync project members from Redmine
   * Fetches members for all projects or specific projects
   * @param projectIds - Optional array of project IDs to sync. If not provided, syncs all projects
   * @param incremental - If true, only syncs members for projects updated after last sync
   */
  async syncProjectMembers(projectIds?: string[], incremental: boolean = false): Promise<{ synced: number; errors: number }> {
    let synced = 0;
    let errors = 0;

    try {
      logger.info('Starting project members sync', { 
        projectIds: projectIds?.length || 'all',
        incremental 
      });

      let projectsToSync;
      if (projectIds && projectIds.length > 0) {
        projectsToSync = await prisma.project.findMany({
          where: {
            id: { in: projectIds }
          },
          select: {
            id: true,
            redmineProjectId: true,
            name: true,
            lastSyncedAt: true
          }
        });
        logger.info('Found projects to sync members for', { count: projectsToSync.length });
      } else {
        if (incremental) {
          const lastSync = await syncStateService.getLastSyncTime('projects');
          if (lastSync) {
            projectsToSync = await prisma.project.findMany({
              where: {
                OR: [
                  { updatedAt: { gte: lastSync } },
                  { lastSyncedAt: { gte: lastSync } }
                ]
              },
              select: {
                id: true,
                redmineProjectId: true,
                name: true,
                lastSyncedAt: true
              }
            });
            logger.info('Found projects to sync members for (incremental)', { 
              count: projectsToSync.length,
              lastSync: lastSync.toISOString()
            });
          } else {
            projectsToSync = await prisma.project.findMany({
              select: {
                id: true,
                redmineProjectId: true,
                name: true,
                lastSyncedAt: true
              }
            });
            logger.info('No previous sync found, syncing all projects', { count: projectsToSync.length });
          }
        } else {
          projectsToSync = await prisma.project.findMany({
            select: {
              id: true,
              redmineProjectId: true,
              name: true,
              lastSyncedAt: true
            }
          });
          logger.info('Full sync - found all projects', { count: projectsToSync.length });
        }
      }

      if (projectsToSync.length === 0) {
        logger.info('No projects to sync members for');
        return { synced: 0, errors: 0 };
      }

      for (const project of projectsToSync) {
        try {
          logger.info('Syncing members for project', {
            projectId: project.id,
            redmineProjectId: project.redmineProjectId,
            projectName: project.name
          });

          const redmineMembers = await redmineService.fetchProjectMembers(project.redmineProjectId);

          logger.info('Fetched members from Redmine', {
            projectId: project.id,
            redmineProjectId: project.redmineProjectId,
            membersCount: redmineMembers.length
          });

          for (const redmineMember of redmineMembers) {
            try {
              let userId: string | null = null;
              if (redmineMember.user?.id) {
                const user = await prisma.user.findUnique({
                  where: { redmineUserId: redmineMember.user.id },
                  select: { id: true }
                });
                userId = user?.id || null;
              }

              const roles = redmineMember.roles || [];

              const existingMembership = await prisma.projectMember.findUnique({
                where: { redmineMembershipId: redmineMember.id }
              });

              if (existingMembership) {
                await prisma.projectMember.update({
                  where: { id: existingMembership.id },
                  data: {
                    userId: userId,
                    redmineUserId: redmineMember.user?.id || null,
                    redmineGroupId: redmineMember.group?.id || null,
                    roles: roles as any,
                    updatedAt: new Date(),
                    lastSyncedAt: new Date()
                  }
                });
              } else {
                await prisma.projectMember.create({
                  data: {
                    redmineMembershipId: redmineMember.id,
                    projectId: project.id,
                    userId: userId,
                    redmineUserId: redmineMember.user?.id || null,
                    redmineGroupId: redmineMember.group?.id || null,
                    roles: roles as any,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    lastSyncedAt: new Date()
                  }
                });
              }

              synced++;
            } catch (memberError: any) {
              logger.error('Error syncing project member', {
                projectId: project.id,
                membershipId: redmineMember.id,
                error: memberError.message
              });
              errors++;
            }
          }

          if (projectsToSync.indexOf(project) < projectsToSync.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        } catch (projectError: any) {
          logger.error('Error syncing members for project', {
            projectId: project.id,
            redmineProjectId: project.redmineProjectId,
            error: projectError.message
          });
          errors++;
        }
      }

      logger.info('Project members sync complete', {
        synced,
        errors,
        projectsProcessed: projectsToSync.length
      });

      return { synced, errors };
    } catch (error: any) {
      logger.error('Project members sync failed', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Full sync - sync all entities (no date filters)
   * Use this for initial setup or when you need complete data refresh
   */
  async fullSync(): Promise<{
    users: { synced: number; errors: number };
    projects: { synced: number; errors: number };
    issues: { synced: number; errors: number };
    timeEntries: { synced: number; errors: number };
  }> {
    const startTime = new Date();

    try {
      // Log sync start
      await prisma.syncLog.create({
        data: {
          syncType: 'full',
          entityType: 'all',
          recordsSynced: 0,
          status: 'success',
          startedAt: startTime,
        },
      });

      logger.info('Starting FULL sync from Redmine (all records)');
      logger.warn('This will fetch all data. Use incremental sync for daily updates.');

      // Sync in order: users -> projects -> issues -> time entries
      // Full sync = no date filters, get everything
      const users = await this.syncUsers(false); // false = full sync (all users)
      const projects = await this.syncProjects(false); // false = full sync (all projects)
      const issues = await this.syncIssues(undefined, undefined, false); // false = full sync (all issues)
      
      // For time entries, start with last 90 days for full sync
      // Can extend later by calling syncTimeEntries with larger daysBack
      const timeEntries = await this.syncTimeEntries(undefined, undefined, false, 90);

      const totalSynced = users.synced + projects.synced + issues.synced + timeEntries.synced;
      const totalErrors = users.errors + projects.errors + issues.errors + timeEntries.errors;

      // Update sync log
      await prisma.syncLog.updateMany({
        where: {
          startedAt: startTime,
          entityType: 'all',
        },
        data: {
          recordsSynced: totalSynced,
          status: totalErrors > 0 ? 'partial' : 'success',
          completedAt: new Date(),
        },
      });

      logger.info('Full sync complete', { totalSynced, totalErrors });

      return {
        users,
        projects,
        issues,
        timeEntries,
      };
    } catch (error: any) {
      logger.error('Full sync failed', { error: error.message, stack: error.stack });

      // Log sync failure
      await prisma.syncLog.updateMany({
        where: {
          startedAt: startTime,
          entityType: 'all',
        },
        data: {
          status: 'failed',
          errorMessage: error.message,
          completedAt: new Date(),
        },
      });

      throw error;
    }
  }

  /**
   * Incremental sync - sync only records updated/created since last sync
   * Uses last_synced_at from sync state to determine what to fetch
   * This is the recommended daily sync strategy
   */
  async incrementalSync(): Promise<{
    users: { synced: number; errors: number };
    projects: { synced: number; errors: number };
    issues: { synced: number; errors: number };
    timeEntries: { synced: number; errors: number };
  }> {
    const startTime = new Date();

    try {
      logger.info('Starting INCREMENTAL sync (only changes since last sync)');
      
      // Get sync state
      const syncTimes = await syncStateService.getAllSyncTimes();
      logger.info('Last sync times', {
        users: syncTimes.users?.toISOString() || 'Never',
        projects: syncTimes.projects?.toISOString() || 'Never',
        issues: syncTimes.issues?.toISOString() || 'Never',
        timeEntries: syncTimes.timeEntries?.toISOString() || 'Never'
      });

      // Sync only what changed since last sync
      // If no previous sync, it will do a full sync for that entity
      const users = await this.syncUsers(true); // true = incremental
      const projects = await this.syncProjects(true); // true = incremental
      const issues = await this.syncIssues(undefined, undefined, true); // true = incremental
      const timeEntries = await this.syncTimeEntries(undefined, undefined, true); // true = incremental

      const totalSynced = users.synced + projects.synced + issues.synced + timeEntries.synced;
      const totalErrors = users.errors + projects.errors + issues.errors + timeEntries.errors;

      // Log sync
      await prisma.syncLog.create({
        data: {
          syncType: 'incremental',
          entityType: 'recent',
          recordsSynced: totalSynced,
          status: totalErrors > 0 ? 'partial' : 'success',
          startedAt: startTime,
          completedAt: new Date(),
        },
      });

      logger.info('Incremental sync complete', {
        totalSynced,
        totalErrors,
        breakdown: {
          users: users.synced,
          projects: projects.synced,
          issues: issues.synced,
          timeEntries: timeEntries.synced
        }
      });

      return { users, projects, issues, timeEntries };
    } catch (error: any) {
      logger.error('Incremental sync failed', { error: error.message, stack: error.stack });
      throw error;
    }
  }
}

export default new SyncService();
