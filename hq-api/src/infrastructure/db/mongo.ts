import { ClientSession, Db, MongoClient, MongoServerError } from 'mongodb';
import { getEnv } from '../../config/env';

let client: MongoClient | null = null;
let database: Db | null = null;

export async function connectMongo(uri?: string, dbName?: string): Promise<Db> {
  if (database && client) {
    return database;
  }

  const env = getEnv();
  const targetUri = uri ?? env.MONGODB_URI;
  const targetDb = dbName ?? env.MONGODB_DB_NAME;

  const mongoClient = new MongoClient(targetUri, {
    maxPoolSize: 20,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
    socketTimeoutMS: 30000,
    retryWrites: true,
    w: 'majority',
  });

  await mongoClient.connect();
  const db = mongoClient.db(targetDb);
  await db.command({ ping: 1 });

  client = mongoClient;
  database = db;
  return db;
}

export function getDb(): Db {
  if (!database) {
    throw new Error('MongoDB not connected. Call connectMongo() first.');
  }
  return database;
}

export function getMongoClient(): MongoClient {
  if (!client) {
    throw new Error('MongoDB client not initialized. Call connectMongo() first.');
  }
  return client;
}

export async function pingMongo(): Promise<boolean> {
  if (!database) return false;
  try {
    await database.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    database = null;
  }
}

/**
 * Executes work inside a MongoDB multi-document ACID transaction (snapshot read, majority write).
 * Falls back to non-transactional execution only if targeting a standalone dev instance without replica set support.
 */
export async function withTransaction<T>(
  work: (session: ClientSession | undefined) => Promise<T>
): Promise<T> {
  const mongoClient = getMongoClient();
  const session = mongoClient.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(
      async () => {
        result = await work(session);
      },
      {
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        readPreference: 'primary',
      }
    );
    return result as T;
  } catch (err) {
    if (err instanceof MongoServerError && err.code === 20 && getEnv().NODE_ENV !== 'production') {
      return await work(undefined);
    }
    throw err;
  } finally {
    await session.endSession();
  }
}
