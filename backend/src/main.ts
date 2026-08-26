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
  app.enableCors({
    origin: (process.env.PWA_ORIGIN ?? 'http://localhost:5173').split(','),
    credentials: true,
  })
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  app.enableShutdownHooks()
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0')
}
void bootstrap()
