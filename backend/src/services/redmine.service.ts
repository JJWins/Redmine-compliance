import axios, { AxiosInstance } from 'axios';
import { config } from '../config/environment';
import { logIncomingData, logBatchData } from '../utils/logger';
import logger from '../utils/logger';

interface RedmineUser {
  id: number;
  login: string;
  firstname: string;
  lastname: string;
  mail: string;
  status: number;
  created_on: string;
  updated_on?: string;
  last_login_on?: string;
}

interface RedmineProject {
  id: number;
  name: string;
  description?: string;
  status: number;
  parent?: { id: number; name: string };
  created_on: string;
  updated_on: string;
}

interface RedmineIssue {
  id: number;
  project: { id: number; name: string };
  tracker: { id: number; name: string };
  status: { id: number; name: string };
  priority: { id: number; name: string };
  author: { id: number; name: string };
  assigned_to?: { id: number; name: string };
  subject: string;
  description?: string;
  estimated_hours?: number;
  spent_hours?: number;
  due_date?: string;
  created_on: string;
  updated_on: string;
}

interface RedmineTimeEntry {
  id: number;
  project: { id: number; name: string };
  issue?: { id: number };
  user: { id: number; name: string };
  activity: { id: number; name: string };
  hours: number;
  comments?: string;
  spent_on: string;
  created_on: string;
  updated_on: string;
}

interface RedmineProjectMember {
  id: number;
  project: { id: number; name: string };
  user?: { id: number; name: string };
  group?: { id: number; name: string };
  roles: Array<{ id: number; name: string; inherited?: boolean }>;
}

interface RedmineResponse<T> {
  [key: string]: any; // For dynamic keys like 'users', 'projects', 'issues', 'time_entries'
  total_count: number;
  offset: number;
  limit: number;
}

class RedmineService {
  private client: AxiosInstance;
  private readonly maxPerPage = 100;

  constructor() {
    this.client = axios.create({
      baseURL: config.redmine.url,
      headers: {
        'X-Redmine-API-Key': config.redmine.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Test Redmine API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      logger.info('Testing Redmine connection', {
        apiKeyPrefix: config.redmine.apiKey.substring(0, 10),
        redmineUrl: config.redmine.url
      });
      const response = await this.client.get('/projects.json', {
        params: { limit: 1 },
      });
      logger.info('Redmine connection successful', { status: response.status });
      return response.status === 200;
    } catch (error: any) {
      logger.error('Redmine connection test failed', {
        error: error.message,
        responseStatus: error.response?.status,
        responseData: error.response?.data
      });
      return false;
    }
  }

  async fetchUsers(): Promise<RedmineUser[]> {
    const allUserIds: number[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await this.client.get<RedmineResponse<{ id: number }>>('/users.json', {
          params: {
            limit: this.maxPerPage,
            offset,
            status: '',
          },
        });

        const users = response.data.users || [];
        const userIds = users.map((u: any) => u.id);
        allUserIds.push(...userIds);

        logger.info('Fetched user IDs from Redmine', {
          offset,
          userIdsCount: userIds.length,
          totalCount: response.data.total_count,
        });

        hasMore = users.length === this.maxPerPage;
        offset += this.maxPerPage;

        if (hasMore) {
          await this.delay(200);
        }
      } catch (error: any) {
        logger.error('Error fetching user IDs', { 
          offset, 
          error: error.message,
          statusCode: error.response?.status,
        });
        throw error;
      }
    }

    logger.info('Total user IDs fetched', { count: allUserIds.length });

    const allUsers: RedmineUser[] = [];
    const batchSize = 10;

    for (let i = 0; i < allUserIds.length; i += batchSize) {
      const batch = allUserIds.slice(i, i + batchSize);
      
      const userPromises = batch.map(async (userId) => {
        try {
          const response = await this.client.get<{ user: RedmineUser }>(`/users/${userId}.json`);
          return response.data.user;
        } catch (error: any) {
          logger.warn('Error fetching user details', { 
            userId, 
            error: error.message,
            statusCode: error.response?.status,
          });
          return null;
        }
      });

      const batchUsers = await Promise.all(userPromises);
      const validUsers = batchUsers.filter((u): u is RedmineUser => u !== null);
      allUsers.push(...validUsers);

      if ((i + batchSize) % 50 === 0 || i + batchSize >= allUserIds.length) {
        logger.info('Fetched user details progress', {
          fetched: Math.min(i + batchSize, allUserIds.length),
          total: allUserIds.length,
        });
      }

      if (i + batchSize < allUserIds.length) {
        await this.delay(300);
      }
    }

    logger.info('Total users with details fetched', { count: allUsers.length });

    if (allUsers.length > 0) {
      logBatchData('redmine-api', 'user', allUsers.slice(0, 10), {
        totalCount: allUsers.length,
        sample: true
      });
    }

    return allUsers;
  }

  async fetchProjects(): Promise<RedmineProject[]> {
    const allProjects: RedmineProject[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await this.client.get<RedmineResponse<RedmineProject>>('/projects.json', {
          params: {
            limit: this.maxPerPage,
            offset,
          },
        });

        const projects = response.data.projects || [];
        
        // Log incoming projects from API
        if (projects.length > 0) {
          logBatchData('redmine-api', 'project', projects, {
            offset,
            limit: this.maxPerPage,
            page: Math.floor(offset / this.maxPerPage) + 1
          });
        }
        
        allProjects.push(...projects);

        hasMore = projects.length === this.maxPerPage;
        offset += this.maxPerPage;

        if (hasMore) {
          await this.delay(200);
        }
      } catch (error: any) {
        logger.error('Error fetching projects', { offset, error: error.message });
        throw error;
      }
    }

    return allProjects;
  }

  async fetchProjectDetails(projectId: number): Promise<any> {
    try {
      const response = await this.client.get(`/projects/${projectId}.json`);
      return response.data.project || null;
    } catch (error: any) {
      logger.warn('Error fetching project details', { 
        projectId, 
        error: error.message,
        statusCode: error.response?.status 
      });
      return null;
    }
  }

  async fetchProjectMembers(projectId: number): Promise<RedmineProjectMember[]> {
    const allMembers: RedmineProjectMember[] = [];
    let offset = 0;
    let hasMore = true;

    logger.info('Fetching project members', { projectId });

    while (hasMore) {
      try {
        const response = await this.client.get<RedmineResponse<RedmineProjectMember>>(
          `/projects/${projectId}/memberships.json`,
          {
            params: {
              limit: this.maxPerPage,
              offset,
            },
          }
        );

        const members = response.data.memberships || [];
        allMembers.push(...members);

        logger.info('Fetched project members', {
          projectId,
          offset,
          membersCount: members.length,
          totalCount: response.data.total_count,
        });

        hasMore = members.length === this.maxPerPage;
        offset += this.maxPerPage;

        if (hasMore) {
          await this.delay(200);
        }
      } catch (error: any) {
        logger.error('Error fetching project members', {
          projectId,
          offset,
          error: error.message,
          statusCode: error.response?.status,
        });
        
        // If it's a 404 or 403, the project might not exist or we don't have permission
        if (error.response?.status === 404 || error.response?.status === 403) {
          logger.warn('Project members not accessible', { projectId, status: error.response.status });
          break;
        }
        
        throw error;
      }
    }

    logger.info('Total project members fetched', { projectId, count: allMembers.length });
    return allMembers;
  }

  /**
   * Fetch issues for a project or all issues
   * Improved with better retry logic and resume capability for large datasets
   */
  async fetchIssues(projectId?: number, updatedAfter?: Date, startOffset?: number): Promise<RedmineIssue[]> {
    const allIssues: RedmineIssue[] = [];
    let offset = startOffset || 0;
    let hasMore = true;
    let totalFetched = 0;
    let consecutiveFailures = 0;
    const maxRetries = 5; // Increased retries
    const maxConsecutiveFailures = 3; // Stop after 3 consecutive failures

    logger.info('Starting issues fetch', { startOffset: startOffset || 0 });

    while (hasMore) {
      let attempt = 0;
      let success = false;

      while (attempt < maxRetries && !success) {
        try {
          const params: any = {
            limit: this.maxPerPage,
            offset,
          };

          if (projectId) {
            params.project_id = projectId;
          }

          if (updatedAfter) {
            params.updated_on = `>=${updatedAfter.toISOString().split('T')[0]}`;
          }

          const response = await this.client.get<RedmineResponse<RedmineIssue>>('/issues.json', {
            params,
            timeout: 90000, // Increased to 90 seconds
          });

          const issues = response.data.issues || [];
          
          if (issues.length > 0 && Math.floor(offset / this.maxPerPage) % 10 === 0) {
            logBatchData('redmine-api', 'issue', issues, {
              offset,
              limit: this.maxPerPage,
              page: Math.floor(offset / this.maxPerPage) + 1,
              projectId: projectId || 'all',
              updatedAfter: updatedAfter?.toISOString()
            });
          }
          
          allIssues.push(...issues);
          totalFetched += issues.length;
          consecutiveFailures = 0;

          if (totalFetched % 500 === 0 || totalFetched < 500) {
            const totalCount = response.data.total_count;
            const progress = totalCount ? Math.round((totalFetched / totalCount) * 100) : 0;
            logger.info('Issues fetch progress', { totalFetched, totalCount, progress });
          }

          hasMore = issues.length === this.maxPerPage;
          offset += this.maxPerPage;
          success = true;

          if (hasMore) {
            await this.delay(500);
          }
        } catch (error: any) {
          attempt++;
          consecutiveFailures++;
          
          if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.message.includes('socket hang up')) {
            if (attempt < maxRetries) {
              const waitTime = Math.min(attempt * 3000, 15000);
              logger.warn('Network error, retrying', { offset, waitTime: waitTime/1000, attempt, maxRetries });
              await this.delay(waitTime);
            } else {
              logger.error('Failed to fetch issues after retries', { offset, maxRetries });
              
              if (consecutiveFailures >= maxConsecutiveFailures) {
                logger.error('Consecutive failures, stopping fetch', {
                  consecutiveFailures: maxConsecutiveFailures,
                  fetchedSoFar: allIssues.length,
                  lastSuccessfulOffset: offset - this.maxPerPage
                });
                hasMore = false;
                break;
              }
              
              logger.warn('Skipping offset and continuing', { offset });
              offset += this.maxPerPage;
              await this.delay(2000);
              break;
            }
          } else {
            logger.error('Error fetching issues', { offset, error: error.message });
            if (error.response?.status === 403 || error.response?.status === 401) {
              throw error;
            }
            offset += this.maxPerPage;
            await this.delay(2000);
            break;
          }
        }
      }
      
      if (!success && consecutiveFailures >= maxConsecutiveFailures) {
        hasMore = false;
      }
    }

    logger.info('Total issues fetched', { count: allIssues.length, lastOffset: allIssues.length > 0 ? offset - this.maxPerPage : 0 });
    return allIssues;
  }

  async fetchTimeEntries(
    userId?: number,
    projectId?: number,
    spentAfter?: Date,
    spentBefore?: Date
  ): Promise<RedmineTimeEntry[]> {
    const allEntries: RedmineTimeEntry[] = [];
    let offset = 0;
    let hasMore = true;
    let totalFetched = 0;

    logger.info('Starting time entries fetch');

    while (hasMore) {
      try {
        const params: any = {
          limit: this.maxPerPage,
          offset,
        };

        if (userId) {
          params.user_id = userId;
        }

        if (projectId) {
          params.project_id = projectId;
        }

        if (spentAfter) {
          params.spent_on = `>=${spentAfter.toISOString().split('T')[0]}`;
        }

        if (spentBefore) {
          params.spent_on = params.spent_on
            ? `${params.spent_on}|<=${spentBefore.toISOString().split('T')[0]}`
            : `<=${spentBefore.toISOString().split('T')[0]}`;
        }

        const response = await this.client.get<RedmineResponse<RedmineTimeEntry>>(
          '/time_entries.json',
          {
            params,
            timeout: 60000, // Increased timeout for large datasets
          }
        );

        const entries = response.data.time_entries || [];
        
        if (entries.length > 0 && Math.floor(offset / this.maxPerPage) % 20 === 0) {
          logBatchData('redmine-api', 'timeEntry', entries, {
            offset,
            limit: this.maxPerPage,
            page: Math.floor(offset / this.maxPerPage) + 1,
            userId: userId || 'all',
            projectId: projectId || 'all',
            dateRange: {
              from: spentAfter?.toISOString(),
              to: spentBefore?.toISOString()
            }
          });
        }
        
        allEntries.push(...entries);
        totalFetched += entries.length;

        if (totalFetched % 1000 === 0 || totalFetched < 1000) {
          logger.info('Time entries fetch progress', { totalFetched });
        }

        hasMore = entries.length === this.maxPerPage;
        offset += this.maxPerPage;

        if (hasMore) {
          await this.delay(300);
        }
      } catch (error: any) {
        logger.error('Error fetching time entries', { offset, error: error.message });
        if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
          logger.warn('Network error, continuing with partial data', { offset, fetchedSoFar: allEntries.length });
          break;
        }
        throw error;
      }
    }

    logger.info('Total time entries fetched', { count: allEntries.length });
    return allEntries;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default new RedmineService();
