import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import type { Request } from 'express'
import { Observable, from, of, switchMap, tap } from 'rxjs'
import { Prisma } from '@prisma/client'
import { PrismaService } from './prisma.service'
import type { AuthUser } from './auth.guard'

/** Idempotency-Key на денежных POST: повтор с тем же ключом отдаёт сохранённый ответ. */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>()
    const key = String(req.headers['idempotency-key'] ?? '')
    const userId = req.user?.id
    if (!key || !userId) return next.handle()
    const fullKey = `${userId}:${key}`

    return from(this.prisma.idempotencyKey.findUnique({ where: { key: fullKey } })).pipe(
      switchMap((hit) => {
        if (hit) return of(hit.response)
        return next.handle().pipe(
          tap((response) => {
            void this.prisma.idempotencyKey
              .create({ data: { key: fullKey, userId, response: (response ?? null) as Prisma.InputJsonValue } })
              .catch(() => undefined)
          }),
        )
      }),
    )
  }
}
