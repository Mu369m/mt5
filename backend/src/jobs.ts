import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { dispatchAlert, type AlertMessage } from './notifications';

const queueName = 'brp-alerts';
const redisUrl = process.env.REDIS_URL;
const redis = redisUrl ? new Redis(redisUrl, { maxRetriesPerRequest: null }) : null;

const alertQueue = redis
  ? new Queue<AlertMessage>(queueName, { connection: redis })
  : null;

if (redis) {
  new Worker<AlertMessage>(queueName, async (job) => {
    await dispatchAlert(job.data);
  }, { connection: redis });
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
