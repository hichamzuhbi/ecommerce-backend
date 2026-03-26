type EnvConfig = Record<string, string | undefined>;

const requiredKeys = [
  'DATABASE_URL',
  'APP_URL',
  'FRONTEND_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_EXPIRES_IN',
  'JWT_REFRESH_EXPIRES_IN',
  'ADMIN_SECRET_KEY',
];

export const validateEnv = (config: EnvConfig): EnvConfig => {
  const missingKeys = requiredKeys.filter((key) => !config[key]);

  if (missingKeys.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingKeys.join(', ')}`,
    );
  }

  return config;
};
