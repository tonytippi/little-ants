import { Module } from '@nestjs/common';
import { OrgModule } from '../org/org.module.js';
import { GoogleIdentityVerifier } from './google-identity.js';
import { ListeningService } from './listening.service.js';
import { ParentAuthService } from './parent-auth.service.js';
import { ParentGuard } from './parent-session.js';
import {
  ParentAuthController,
  ParentController,
  SchoolParentsController,
  StudentParentsController,
} from './parents.controller.js';

@Module({
  imports: [OrgModule],
  controllers: [ParentAuthController, ParentController, StudentParentsController, SchoolParentsController],
  providers: [GoogleIdentityVerifier, ParentAuthService, ParentGuard, ListeningService],
  exports: [ParentAuthService, ListeningService],
})
export class ParentsModule {}
