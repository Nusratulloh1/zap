import { Global, Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PrismaService } from './prisma.service'
import { IdempotencyInterceptor } from './idempotency.interceptor'

@Global()
@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  providers: [PrismaService, IdempotencyInterceptor],
  exports: [PrismaService, IdempotencyInterceptor],
})
export class CommonModule {}
