import { Module } from '@nestjs/common';
import { AssetUrls } from '../assets/asset-urls.service.js';
import { AssetsController } from '../assets/assets.controller.js';
import { ReleaseBuilder } from '../releases/release-builder.service.js';
import { ReleasesController } from '../releases/releases.controller.js';
import { TeachController, TeacherNotesController } from '../teach/teach.controller.js';
import { ContentService } from './content.service.js';
import { ItemsController } from './items.controller.js';
import { UnitsController } from './units.controller.js';

@Module({
  controllers: [UnitsController, ItemsController, AssetsController, ReleasesController, TeachController, TeacherNotesController],
  providers: [ContentService, ReleaseBuilder, AssetUrls],
})
export class ContentModule {}
