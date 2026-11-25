import { getEnv } from './config/env';
import { closeMongo, connectMongo } from './infrastructure/db/mongo';
import { runMigrations } from './infrastructure/db/migrations';
import { createApp } from './app';

async function bootstrap(): Promise<void> {
  const env = getEnv();
  const db = await connectMongo();
  await runMigrations(db);

  const app = createApp();

  const server = Bun.serve({
    port: env.PORT,
    fetch: app.fetch,
  });

  console.log(
    `[thea-hq-api] Listening on http://localhost:${server.port} (env=${env.NODE_ENV}, db=${env.MONGODB_DB_NAME})`
  );

  const shutdown = async (signal: string) => {
    console.log(`[thea-hq-api] Received ${signal}, shutting down...`);
    server.stop(true);
    await closeMongo();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('[thea-hq-api] Fatal startup error:', err);
  process.exit(1);
});
