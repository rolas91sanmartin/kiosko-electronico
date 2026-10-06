import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { static as serveStatic } from 'express';
import * as path from 'node:path';
import { AppModule } from './app.module';
import { loadJsonConfiguration, validateProductionConfiguration } from './configuration';
import { PersistentExceptionFilter } from './common/persistent-exception.filter';
import { PersistentLogService } from './kiosk/persistent-log.service';

async function bootstrap() {
  loadJsonConfiguration();
  validateProductionConfiguration();
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.enableShutdownHooks();
  app.use(json({ limit: '12mb' }));
  app.use(urlencoded({ extended: true, limit: '12mb' }));
  app.setGlobalPrefix('api');
  app.use('/api/face-assets', serveStatic(path.resolve(process.cwd(), 'public', 'face'), { immutable: true, maxAge: '1d' }));
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const persistentLogs = app.get(PersistentLogService);
  app.useGlobalFilters(new PersistentExceptionFilter(persistentLogs));
  app.use((request: { method: string; originalUrl: string }, response: { statusCode: number; on(event: string, listener: () => void): void }, next: () => void) => {
    const started = Date.now();
    response.on('finish', () => void persistentLogs.write('http.request', `${request.method} ${request.originalUrl} ${response.statusCode} ${Date.now() - started}ms`, response.statusCode >= 500 ? 'error' : 'info').catch(() => undefined));
    next();
  });

  if (process.env.SWAGGER_ENABLED !== 'false') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Kiosko API')
      .setDescription('API del kiosko móvil para asistencia, pagos, fotografías y reportes.')
      .setVersion('1.0')
      .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'api-key')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(Number(process.env.PORT || 3000), '0.0.0.0');
}
void bootstrap();
