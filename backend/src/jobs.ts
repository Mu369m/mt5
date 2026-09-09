import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { dispatchAlert, type AlertMessage } from './notifications';

const queueName = 'brp-alerts';
const configuredRedisUrl = process.env.REDIS_URL;

let parsedRedisUrl: URL | null = null;
let redisUrlIsLocal = false;

if (configuredRedisUrl) {
  try {
    parsedRedisUrl = new URL(configuredRedisUrl);
    redisUrlIsLocal = ['localhost', '127.0.0.1', '::1'].includes(parsedRedisUrl.hostname);
  } catch {
    parsedRedisUrl = null;
    redisUrlIsLocal = false;
  }
}

const wantsProductionRedis = process.env.NODE_ENV === 'production' && !redisUrlIsLocal && parsedRedisUrl !== null;
const redisUrl = wantsProductionRedis ? configuredRedisUrl : undefined;
const redis = redisUrl ? new Redis(redisUrl, { maxRetriesPerRequest: null }) : null;

if (!redisUrl) {
  console.warn('[REDIS_DISABLED] Production REDIS_URL is missing, localhost, or unparseable; falling back to direct email alerts');
}

const alertQueue = redis
  ? new Queue<AlertMessage>(queueName, { connection: redis })
  : null;

if (redis) {
  redis.on('error', (error) => console.error('[REDIS_CONNECTION_ERROR]', error.message));
  new Worker<AlertMessage>(queueName, async (job) => {
    await dispatchAlert(job.data);
  }, { connection: redis }).on('error', (error) => {
    console.error('[ALERT_WORKER_ERROR]', error.message);
  });
}

export async function enqueueAlert(message: AlertMessage): Promise<void> {
  if (!alertQueue) {
    await dispatchAlert(message);
    return;
  }

  await alertQueue.add('deliver-alert', message, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  });
}

export async function closeJobConnections(): Promise<void> {
  await alertQueue?.close();
  await redis?.quit();
}
