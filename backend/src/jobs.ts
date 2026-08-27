import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { dispatchAlert, type AlertMessage } from './notifications';

const queueName = 'brp-alerts';
const configuredRedisUrl = process.env.REDIS_URL;
const redisUrlIsLocal = configuredRedisUrl
  ? ['localhost', '127.0.0.1', '::1'].includes(new URL(configuredRedisUrl).hostname)
  : false;
const redisUrl = process.env.NODE_ENV === 'production' && redisUrlIsLocal ? undefined : configuredRedisUrl;
const redis = redisUrl ? new Redis(redisUrl, { maxRetriesPerRequest: null }) : null;

if (configuredRedisUrl && !redisUrl) {
  console.warn('[REDIS_DISABLED] Production REDIS_URL points to localhost; configure Railway Redis before enabling BullMQ');
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
