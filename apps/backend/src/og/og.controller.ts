import { Controller, Get, Header, Param, Res } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { Response } from 'express'
import { readFile, stat } from 'node:fs/promises'
import { SplitsService } from '../splits/splits.service'

/**
 * Страница /s/:code с Open Graph — чтобы ссылка на сплит в Telegram и
 * WhatsApp разворачивалась карточкой, а не голым текстом.
 *
 * Веб — SPA, а скрейперы превью не выполняют JavaScript: они читают только
 * первый HTML-ответ. Поэтому мета-теги нельзя проставить на клиенте, их надо
 * отдать сервером. Здесь берётся собранный index.html, и в его <head>
 * вставляются og:*-теги конкретного сплита.
 *
 * Отдаём один и тот же документ и людям, и скрейперам: никакого разбора
 * User-Agent. Человек получает обычное приложение (SPA поднимется из того же
 * html), скрейпер — заголовки. Так превью не расходится с тем, что видно.
 *
 * Подключается в nginx:
 *
 *   location ^~ /s/ {
 *       proxy_pass http://127.0.0.1:3202/og/s/;
 *       proxy_set_header Host $host;
 *   }
 *
 * og:image пока один на все сплиты — брендовый постер /og-default.png.
 * Пер-сплитная картинка (сумма, заведение, лица) потребует рендера на
 * сервере; заголовок и описание уже персональные, и этого достаточно, чтобы
 * ссылка перестала выглядеть пустой.
 */
@Controller('og')
export class OgController {
  constructor(private readonly splits: SplitsService) {}

  /** index.html собранного веба; читаем с диска и кэшируем по mtime. */
  private cache: { mtimeMs: number; html: string } | null = null

  private get indexPath(): string {
    return process.env.WEB_INDEX_PATH ?? '/var/www/zapapp/index.html'
  }

  private get origin(): string {
    return process.env.PUBLIC_ORIGIN ?? 'https://zapapp.uz'
  }

  private async shell(): Promise<string> {
    const p = this.indexPath
    const st = await stat(p)
    if (this.cache && this.cache.mtimeMs === st.mtimeMs) return this.cache.html
    const html = await readFile(p, 'utf8')
    this.cache = { mtimeMs: st.mtimeMs, html }
    return html
  }

  @Get('s/:code')
  @Header('Cache-Control', 'public, max-age=120')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  async page(@Param('code') code: string, @Res() res: Response) {
    let html: string
    try {
      html = await this.shell()
    } catch {
      // веб ещё не собран/не смонтирован — пусть nginx отдаёт как раньше
      res.status(404).send('Not found')
      return
    }

    let title = 'ZAP! — bir chek, bir guruh'
    let description = 'Hisobni do‘stlaringiz bilan bo‘ling'

    try {
      const v = await this.splits.publicByCode(code)
      const name = v.merchant?.name ?? v.title
      const total = new Intl.NumberFormat('ru-RU').format(v.totalAmount)
      title = `${name} — ${total} UZS`
      description = `${v.memberCount} kishi · hisobni ZAP! da bo‘ling`
    } catch {
      // сплита нет или он закрыт для просмотра — отдаём брендовые заголовки
    }

    const url = `${this.origin}/s/${encodeURIComponent(code)}`
    const image = `${this.origin}/og-default.png`
    const meta = [
      `<meta property="og:type" content="website" />`,
      `<meta property="og:site_name" content="ZAP!" />`,
      `<meta property="og:title" content="${esc(title)}" />`,
      `<meta property="og:description" content="${esc(description)}" />`,
      `<meta property="og:url" content="${esc(url)}" />`,
      `<meta property="og:image" content="${esc(image)}" />`,
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${esc(title)}" />`,
      `<meta name="twitter:description" content="${esc(description)}" />`,
      `<meta name="twitter:image" content="${esc(image)}" />`,
    ].join('\n    ')

    res.type('html').send(html.replace('</head>', `    ${meta}\n  </head>`))
  }
}

/** Экранирование под значение HTML-атрибута: название заведения приходит извне. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
