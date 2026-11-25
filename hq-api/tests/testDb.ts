import { MongoMemoryReplSet, MongoMemoryServer } from 'mongodb-memory-server';
import { resetEnvCache } from '../src/config/env';
import { closeMongo, connectMongo } from '../src/infrastructure/db/mongo';
import { runMigrations } from '../src/infrastructure/db/migrations';
import { clearRateLimitBuckets } from '../src/middleware/rateLimit';

export interface TestDbHandle {
  uri: string;
  dbName: string;
  stop: () => Promise<void>;
}

/**
 * Starts a hermetic real MongoDB instance (replica set when available for ACID transactions)
 * so integration tests verify real $jsonSchema validators, indexes, Decimal128, and transactions
 * without depending on external Atlas IP allowlists.
 */
export async function startTestDb(dbName: string): Promise<TestDbHandle> {
  let replSet: MongoMemoryReplSet | null = null;
  let standalone: MongoMemoryServer | null = null;
  let uri: string;

  try {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    uri = replSet.getUri(dbName);
  } catch {
    standalone = await MongoMemoryServer.create();
    uri = standalone.getUri(dbName);
  }

  process.env.MONGODB_URI = uri;
  process.env.MONGODB_DB_NAME = dbName;
  resetEnvCache();
  clearRateLimitBuckets();
  await closeMongo();
  const db = await connectMongo(uri, dbName);
  await runMigrations(db);

  return {
    uri,
    dbName,
    stop: async () => {
      await closeMongo();
      if (replSet) await replSet.stop();
      if (standalone) await standalone.stop();
    },
  };
}
