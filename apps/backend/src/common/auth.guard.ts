import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, createParamDecorator } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'
import { PrismaService } from './prisma.service'

export interface AuthUser {
  id: string
  phone: string
}

/** Bearer access-токен → req.user */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>()
    const token = (req.headers.authorization ?? '').replace(/^Bearer /, '')
    if (!token) throw new UnauthorizedException()
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; phone: string; typ: string }>(token)
      if (payload.typ !== 'access') throw new Error('wrong typ')
      req.user = { id: payload.sub, phone: payload.phone }
      return true
    } catch {
      throw new UnauthorizedException()
    }
  }
}

/** Денежные ручки: одноразовый paymentToken (2 мин, jti сжигается). */
@Injectable()
export class PaymentTokenGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>()
    const token = String(req.headers['x-payment-token'] ?? '')
    if (!token) throw new UnauthorizedException('Требуется подтверждение PIN')
    try {
      const p = await this.jwt.verifyAsync<{ sub: string; typ: string; jti: string }>(token)
      if (p.typ !== 'payment' || p.sub !== req.user?.id) throw new Error('bad')
      await this.prisma.consumedJti.create({ data: { jti: p.jti } }) // unique → повтор = throw
      return true
    } catch {
      throw new UnauthorizedException('PIN-подтверждение недействительно')
    }
  }
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<{ user: AuthUser }>().user
})
