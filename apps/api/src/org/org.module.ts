import { Module } from '@nestjs/common';
import { OrgController } from './org.controller.js';
import { StaffController } from './staff.controller.js';

@Module({
  controllers: [OrgController, StaffController],
})
export class OrgModule {}
