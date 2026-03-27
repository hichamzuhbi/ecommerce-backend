type EnvConfig = Record<string, string | undefined>;

const requiredKeys = [
  'APP_URL',
  'FRONTEND_URL',
  'SUPABASE_URL',
  'SUPABASE_KEY',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_EXPIRES_IN',
  'JWT_REFRESH_EXPIRES_IN',
  'ADMIN_SECRET_KEY',
];

export const validateEnv = (config: EnvConfig): EnvConfig => {
  const hasDatabaseConnection =
    Boolean(config.DATABASE_POOLER_URL) || Boolean(config.DATABASE_URL);

  if (!hasDatabaseConnection) {
    throw new Error(
      'Missing database connection: set DATABASE_POOLER_URL or DATABASE_URL',
    );
  }

  const missingKeys = requiredKeys.filter((key) => !config[key]);

  if (missingKeys.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingKeys.join(', ')}`,
    );
  }

  return config;
};
