// HTTPS-дев для теста с ТЕЛЕФОНА по Wi-Fi: mkcert-сертификат + --host,
// API проксируется через тот же https-origin (/api) — без mixed-content.
// Требуется запущенный бэкенд (pnpm dev:all в соседнем окне) на :3202.
import { spawn } from 'node:child_process'
import os from 'node:os'

const nets = os.networkInterfaces()
const lan = Object.values(nets)
  .flat()
  .find((n) => n && n.family === 'IPv4' && !n.internal && /^(192\.168\.|10\.)/.test(n.address))

console.log('┏━━ DEV HTTPS ━━')
console.log('┃ на телефоне (та же Wi-Fi): https://' + (lan?.address ?? '<ip-компьютера>') + ':5173')
console.log('┃ при первом заходе доверьте сертификат mkcert')
console.log('┗━━━━━━━━━━━━━━')

const child = spawn('pnpm', ['dev', '--port', '5173', '--strictPort'], {
  shell: true,
  stdio: 'inherit',
  env: { ...process.env, DEV_HTTPS: '1', VITE_API_URL: '/api' },
})
child.on('exit', (c) => process.exit(c ?? 0))
