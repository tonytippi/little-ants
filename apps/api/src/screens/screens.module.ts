import { Module } from '@nestjs/common';
import { ParentsModule } from '../parents/parents.module.js';
import { ParentGuard } from '../parents/parent-session.js';
import { ParentScreensController, ScreensController } from './screens.controller.js';
import { ScreensService } from './screens.service.js';

@Module({
  imports: [ParentsModule],
  controllers: [ParentScreensController, ScreensController],
  providers: [ScreensService, ParentGuard],
})
export class ScreensModule {}
