import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller.js';
import { OrgController } from './org.controller.js';
import { OrgService } from './org.service.js';
import { SchoolsController } from './schools.controller.js';
import { StaffController } from './staff.controller.js';

@Module({
  controllers: [SchoolsController, OrgController, StaffController, DashboardController],
  providers: [OrgService],
  exports: [OrgService],
})
export class OrgModule {}
