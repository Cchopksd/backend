import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './app.config.js';
import databaseConfig from './database.config.js';
import { validateEnvironment } from './environment.validation.js';
import rabbitMqConfig from './rabbitmq.config.js';
import redisConfig from './redis.config.js';
import firebaseConfig from './firebase.config.js';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig, databaseConfig, redisConfig, rabbitMqConfig, firebaseConfig],
      validate: validateEnvironment,
    }),
  ],
  exports: [ConfigModule],
})
export class AppConfigModule {}
