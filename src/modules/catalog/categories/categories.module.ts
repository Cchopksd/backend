import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module.js';
import { AuthModule } from '../../auth/auth.module.js';
import { CategoriesController } from './controllers/categories.controller.js';
import { CategoriesRepository } from './repositories/categories.repository.js';
import { CategoriesService } from './services/categories.service.js';
@Module({ imports: [DatabaseModule, AuthModule], controllers: [CategoriesController], providers: [CategoriesRepository, CategoriesService], exports: [CategoriesService] })
export class CategoriesModule {}
