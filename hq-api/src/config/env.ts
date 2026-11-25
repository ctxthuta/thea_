import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().min(10, 'MONGODB_URI is required'),
  MONGODB_DB_NAME: z.string().min(1).default('thea_hq'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  SUPER_ADMIN_EMAIL: z.string().email('SUPER_ADMIN_EMAIL must be a valid email'),
  SUPER_ADMIN_PASSWORD: z.string().min(6, 'SUPER_ADMIN_PASSWORD must be at least 6 characters'),
  SUPER_ADMIN_NAME: z.string().min(1).default('Super Admin'),
  PUBLIC_INGEST_SECRET: z.string().min(16, 'PUBLIC_INGEST_SECRET must be at least 16 characters'),
  CORS_ALLOWED_ORIGINS: z.string().min(1).default('http://localhost:5173,http://localhost:3000'),
  TRUST_PROXY: z
    .preprocess((val) => val === true || val === 'true' || val === '1', z.boolean())
    .default(false),
});

export type EnvConfig = z.infer<typeof envSchema> & {
  corsOrigins: string[];
  superAdminEmailNormalized: string;
};

let cachedEnv: EnvConfig | null = null;

export function loadEnv(source: Record<string, string | undefined> = process.env): EnvConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  const corsOrigins = parsed.data.CORS_ALLOWED_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return {
    ...parsed.data,
    corsOrigins,
    superAdminEmailNormalized: parsed.data.SUPER_ADMIN_EMAIL.trim().toLowerCase(),
  };
}

export function getEnv(): EnvConfig {
  if (!cachedEnv) {
    cachedEnv = loadEnv();
  }
  return cachedEnv;
}

export function resetEnvCache(): void {
  cachedEnv = null;
}
