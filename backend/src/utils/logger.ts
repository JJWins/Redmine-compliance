import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Note: dataInspectionFormat removed as we're using JSON format directly

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'redmine-dashboard' },
  transports: [
    // Write info and warnings to app.log
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      level: 'info', // info, warn
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    }),
    // Write errors to error.log
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    }),
  ],
});

// If not in production, also log to console
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Helper function to log incoming data for inspection
export const logIncomingData = (source: string, dataType: string, data: any, metadata?: any) => {
  logger.info('Incoming Data', {
    source, // e.g., 'redmine-api', 'sync-service'
    dataType, // e.g., 'user', 'project', 'issue', 'timeEntry'
    data: JSON.parse(JSON.stringify(data)), // Deep clone to avoid reference issues
    metadata: metadata || {},
    timestamp: new Date().toISOString()
  });
  
  // Also write to data-inspection.log with detailed format
  logger.info(`[${source}] ${dataType}`, {
    ...data,
    ...metadata,
    _source: source,
    _dataType: dataType,
    _timestamp: new Date().toISOString()
  });
};

// Helper function to log batch data
export const logBatchData = (source: string, dataType: string, items: any[], metadata?: any) => {
  // Log batch summary
  logger.info(`[${source}] Batch ${dataType}`, {
    count: items.length,
    ...metadata,
    _source: source,
    _dataType: dataType,
    _timestamp: new Date().toISOString()
  });
  
  // Log each item individually for inspection
  items.forEach((item, index) => {
    logIncomingData(source, dataType, item, {
      ...metadata,
      batchIndex: index,
      batchSize: items.length
    });
  });
};

export default logger;

