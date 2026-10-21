import { Global, Module } from '@nestjs/common';
import { createStorageFromEnv } from '@little-ants/storage';
import { REPO_ROOT } from '../config/env.js';
import { LocalStorageController } from './local-storage.controller.js';
import { OBJECT_STORAGE } from './storage.tokens.js';

@Global()
@Module({
  controllers: [LocalStorageController],
  providers: [{ provide: OBJECT_STORAGE, useFactory: () => createStorageFromEnv(process.env, REPO_ROOT) }],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
