# --- build ---
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install
COPY prisma ./prisma
RUN pnpm prisma:generate
COPY tsconfig.json nest-cli.json ./
COPY src ./src
COPY scripts ./scripts
RUN pnpm build

# --- runtime ---
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod
COPY prisma ./prisma
RUN pnpm prisma generate
COPY --from=build /app/dist ./dist
EXPOSE 3000
# миграции при старте, затем API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
