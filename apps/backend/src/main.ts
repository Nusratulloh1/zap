import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import helmet from 'helmet'
import { Logger } from 'nestjs-pino'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  app.useLogger(app.get(Logger))
  app.use(helmet())
  // за nginx: реальные IP клиентов для rate-limit и логов
  app.getHttpAdapter().getInstance().set('trust proxy', 1)
  const devOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/
  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? // CORS_ORIGINS — список хостов через запятую (лендинг + платформа);
          // PWA_ORIGIN отдельно, он задаёт адрес ссылок в SMS
          (process.env.CORS_ORIGINS ?? process.env.PWA_ORIGIN ?? 'http://localhost:5173').split(',')
        : (origin, cb) => cb(null, !origin || devOrigin.test(origin)),
    credentials: true,
  })
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  app.enableShutdownHooks()
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0')
}
void bootstrap()

