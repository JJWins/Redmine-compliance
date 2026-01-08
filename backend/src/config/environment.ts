import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    url: process.env.DATABASE_URL || '',
  },
  redmine: {
    url: process.env.REDMINE_URL || 'https://redmine.polussolutions.com',
    apiKey: process.env.REDMINE_API_KEY || '',
  },
  jobs: {
    syncIntervalHours: parseInt(process.env.SYNC_INTERVAL_HOURS || '1', 10),
    dailyDigestTime: process.env.DAILY_DIGEST_TIME || '09:00',
  },
  cors: {
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200',
  },
};

// Validate required environment variables
if (!config.database.url) {
  throw new Error('DATABASE_URL is required');
}

if (!config.redmine.apiKey) {
  console.warn('⚠️  REDMINE_API_KEY is not set. Redmine sync will not work.');
}

