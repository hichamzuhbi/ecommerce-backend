import 'dotenv/config';
import { DataSource } from 'typeorm';

const isProduction = process.env.NODE_ENV === 'production';
const dbSsl = process.env.DB_SSL;
const useSsl = dbSsl ? dbSsl === 'true' : isProduction;

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  logging: !isProduction,
  entities: [isProduction ? 'dist/**/*.entity.js' : 'src/**/*.entity.ts'],
  migrations: [isProduction ? 'dist/migrations/*.js' : 'src/migrations/*.ts'],
  ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});
