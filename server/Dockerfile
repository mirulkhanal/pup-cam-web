FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY package.json ./
RUN pnpm install
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
EXPOSE 3001
CMD ["pnpm", "exec", "tsx", "src/index.ts"]
