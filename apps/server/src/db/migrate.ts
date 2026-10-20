import { loadConfig, loadDotEnv } from '../config/env';
import { createLogger } from '../lib/logger';
import { createDatabase } from './client';

loadDotEnv();
const config = loadConfig();
const logger = createLogger(config);
const handle = await createDatabase(config, logger);

try {
  await handle.migrate();
  logger.info('migrations applied');
} catch (error) {
  logger.error({ err: error }, 'migration failed');
  process.exitCode = 1;
} finally {
  await handle.close();
}
