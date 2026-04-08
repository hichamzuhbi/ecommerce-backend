/* eslint-disable @typescript-eslint/no-floating-promises */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { join } from 'path';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const allowedOrigins = (process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  const localhostRegex = /^https?:\/\/localhost(?::\d+)?$/i;
  const azureFrontendRegex =
    /^https:\/\/shopnow-[a-z0-9-]+\.westeurope-01\.azurewebsites\.net$/i;

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (
        allowedOrigins.includes(origin) ||
        localhostRegex.test(origin) ||
        azureFrontendRegex.test(origin)
      ) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  });
  app.useStaticAssets(join(__dirname, '..', 'public'));

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const config = new DocumentBuilder()
    .setTitle('E-Commerce API')
    .setDescription('Complete e-commerce backend API with NestJS')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT || 3000);
  const host = '0.0.0.0';
  await app.listen(port, host);

  const appUrl = process.env.APP_URL ?? (await app.getUrl());
  console.log(`Application is running on: ${appUrl}`);
  console.log(`Swagger documentation: ${appUrl}/api/docs`);
}
bootstrap();
