import pino from 'pino';
import { config } from './config';

const destinations: pino.StreamEntry[] = [{ stream: process.stdout }];

if (config.LOG_FILE) {
  destinations.push({ stream: pino.destination(config.LOG_FILE) });
}

export const logger = pino(
  { level: config.LOG_LEVEL },
  pino.multistream(destinations),
);
