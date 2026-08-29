import { Module } from '@nestjs/common';
import { CategoriesModule } from './categories/categories.module.js';
import { ProductsModule } from './products/products.module.js';
import { SkusModule } from './skus/skus.module.js';
import { VariantsModule } from './variants/variants.module.js';

@Module({ imports: [CategoriesModule, ProductsModule, VariantsModule, SkusModule] })
export class CatalogModule {}
