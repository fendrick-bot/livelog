import { pino, type Logger } from 'pino';
import type { Config } from '../config/env';

export type { Logger };

export function createLogger(config: Pick<Config, 'logLevel' | 'isProd' | 'isTest'>): Logger {
  return pino({
    level: config.isTest ? 'silent' : config.logLevel,
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      remove: true,
    },
    ...(config.isProd || config.isTest
      ? {}
      : {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
          },
        }),
  });
}
