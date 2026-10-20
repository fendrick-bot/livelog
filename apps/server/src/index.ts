import { createServer } from 'node:http';
import { createApp } from './app';
import { loadConfig, loadDotEnv } from './config/env';
import { createContainer } from './container';
import { createDatabase } from './db/client';
import { createLogger } from './lib/logger';
import { createMailer } from './modules/notifications/mailer';
import { createRealtime } from './realtime/gateway';

loadDotEnv();
const config = loadConfig();
const logger = createLogger(config);

const database = await createDatabase(config, logger);
if (config.db.autoMigrate) {
  await database.migrate();
  logger.info('database migrations applied');
}

const container = createContainer({
  config,
  logger,
  database,
  mailer: createMailer(config.mail, logger),
});

const app = createApp(container);
const server = createServer(app);
const realtime = createRealtime(server, container);

container.live.start();
container.outboxWorker.start();

server.listen(config.port, config.host, () => {
  logger.info(`livelog api listening on http://localhost:${config.port}`);
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down gracefully');
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  try {
    server.close();
    await realtime.close();
    await container.live.stop(); // persists any live text still in memory
    await container.outboxWorker.stop();
    container.events.removeAll();
    await database.close();
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, 'error during shutdown');
    process.exit(1);
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => logger.error({ err: reason }, 'unhandled rejection'));
