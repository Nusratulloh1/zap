// Socket.IO: namespace /realtime. Авторизованные клиенты — JWT в handshake.auth.token
// (комната user:{id}); участники по ссылке входят в split:{code} — сам код и есть capability.
import { Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import type { Server, Socket } from 'socket.io'

export type SplitEventKind = 'member_opened' | 'member_paid' | 'member_covered' | 'split_closed' | 'debt_settled'

@WebSocketGateway({ namespace: '/realtime', cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server

  private readonly log = new Logger(RealtimeGateway.name)

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: Socket) {
    const token = String(client.handshake.auth?.token ?? '')
    if (token) {
      try {
        const p = await this.jwt.verifyAsync<{ sub: string; typ: string }>(token)
        if (p.typ === 'access') {
          await client.join(`user:${p.sub}`)
          client.data.userId = p.sub
        }
      } catch {
        /* публичный клиент — остаётся без user-комнаты */
      }
    }
  }

  /** участник по ссылке подписывается на комнату сплита кодом */
  @SubscribeMessage('join_split')
  async joinSplit(@ConnectedSocket() client: Socket, @MessageBody() body: { code?: string }) {
    const code = String(body?.code ?? '').slice(0, 16)
    if (!/^[\dA-Z-]{5,12}$/i.test(code)) return { ok: false }
    await client.join(`split:${code.toUpperCase()}`)
    return { ok: true }
  }

  emitSplit(code: string, kind: SplitEventKind, payload: Record<string, unknown>) {
    this.server?.to(`split:${code.toUpperCase()}`).emit(kind, payload)
  }

  emitUser(userId: string, event: string, payload: Record<string, unknown>) {
    this.server?.to(`user:${userId}`).emit(event, payload)
  }
}
