import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { loadEnv } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { createAuth } from './auth.js';
import { AuthGuard } from './auth.guard.js';
import { MeController } from './me.controller.js';
import { AUTH, BetterAuthSessionResolver, SessionResolver } from './session-resolver.js';

@Global()
@Module({
  controllers: [MeController],
  providers: [
    {
      provide: AUTH,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => createAuth(prisma.client, loadEnv()),
    },
    { provide: SessionResolver, useClass: BetterAuthSessionResolver },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AUTH, SessionResolver],
})
export class AuthModule {}
