import { connectMongo, closeMongo } from './mongo';
import { runMigrations } from './migrations';

async function main(): Promise<void> {
  try {
    const db = await connectMongo();
    await runMigrations(db);
    console.log('[migrate] All collections, validators, indexes, settings, and COA accounts verified.');
  } finally {
    await closeMongo();
  }
}

main().catch((err) => {
  console.error('[migrate] Failed:', err);
  process.exit(1);
});
