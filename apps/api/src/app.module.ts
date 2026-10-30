import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AuthModule } from './auth/auth.module.js';
import { ContentModule } from './content/content.module.js';
import { PrismaExceptionFilter } from './common/prisma-exception.filter.js';
import { HealthController } from './health/health.controller.js';
import { ImportsModule } from './imports/imports.module.js';
import { OrgModule } from './org/org.module.js';
import { ParentsModule } from './parents/parents.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ScreensModule } from './screens/screens.module.js';
import { StorageModule } from './storage/storage.module.js';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    AuthModule,
    OrgModule,
    ParentsModule,
    ContentModule,
    ImportsModule,
    ScreensModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: PrismaExceptionFilter }],
})
export class AppModule {}
