import express, { Express } from 'express';
import cors from 'cors';
import { config } from './config/environment';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/logger';
import routes from './routes';
import cronService from './services/cron.service';
import logger from './utils/logger';

const app: Express = express();

// Middleware
app.use(cors({
  origin: config.cors.frontendUrl,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api', routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = config.port;

app.listen(PORT, () => {
  logger.info('Server started', {
    port: PORT,
    environment: config.nodeEnv,
    frontendUrl: config.cors.frontendUrl
  });
  
  // Initialize cron jobs
  if (config.nodeEnv !== 'test') {
    cronService.initialize();
  }
});

export default app;

