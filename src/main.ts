import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors();

  // Global validation pipe for all request DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Enable graceful shutdown
  app.enableShutdownHooks();

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`=======================================================`);
  logger.log(`🚀 NestJS Booking Server running at http://localhost:${port}`);
  logger.log(`📦 Database: SQLite (local disk, no Docker needed)`);
  logger.log(`⚡ Redis: Native Redis Server (port 6379, no Docker needed)`);
  logger.log(`=======================================================`);
  logger.log(`Available Endpoints:`);
  logger.log(`  GET    /resources                 - List all resources (cached in Redis)`);
  logger.log(`  POST   /resources                 - Create a new bookable resource`);
  logger.log(`  GET    /resources/:id             - Get resource details`);
  logger.log(`  PATCH  /resources/:id             - Update resource`);
  logger.log(`  DELETE /resources/:id             - Delete resource`);
  logger.log(`  POST   /bookings                  - Create booking (Distributed Redis Lock)`);
  logger.log(`  GET    /bookings                  - List bookings (filters: resourceId, status, date)`);
  logger.log(`  GET    /bookings/availability/:id - Check booked slots for a date`);
  logger.log(`  GET    /bookings/:id              - Get booking details`);
  logger.log(`  PATCH  /bookings/:id/cancel       - Cancel booking`);
  logger.log(`=======================================================`);
}

bootstrap();
