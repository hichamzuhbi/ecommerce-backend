import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';
  const isProduction = nodeEnv === 'production';
  const databaseUrl =
    process.env.DATABASE_POOLER_URL ??
    configService.get<string>('DATABASE_POOLER_URL') ??
    process.env.DATABASE_URL ??
    configService.getOrThrow<string>('DATABASE_URL');

  return {
    type: 'postgres',
    url: databaseUrl,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: false,
    logging: !isProduction,
    connectTimeoutMS: 30000,
    ssl: { rejectUnauthorized: false },
  };
};
