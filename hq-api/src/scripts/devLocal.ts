import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { resetEnvCache, getEnv } from '../config/env';
import { closeMongo, connectMongo } from '../infrastructure/db/mongo';
import { runSeed } from '../infrastructure/db/seed';
import { createApp } from '../app';

async function startLocalPreview(): Promise<void> {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });

  process.env.MONGODB_URI = replSet.getUri('thea_hq');
  process.env.MONGODB_DB_NAME = 'thea_hq';
  resetEnvCache();

  const env = getEnv();
  await connectMongo();
  await runSeed();

  const app = createApp();
  const server = Bun.serve({
    port: env.PORT,
    fetch: app.fetch,
  });

  console.log(
    `[thea-hq-local] Listening on http://localhost:${server.port} (local WiredTiger replica set, db=${env.MONGODB_DB_NAME})`
  );

  const shutdown = async (signal: string) => {
    console.log(`[thea-hq-local] Received ${signal}, shutting down...`);
    server.stop(true);
    await closeMongo();
    await replSet.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

startLocalPreview().catch((err) => {
  console.error('[thea-hq-local] Startup error:', err);
  process.exit(1);
});
