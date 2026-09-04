FROM node:22.22.3-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run db:generate && npm run build

# One-shot migration image. It intentionally keeps devDependencies because
# the Prisma CLI is a development dependency.
FROM deps AS migrate
COPY prisma ./prisma
CMD ["npx", "prisma", "migrate", "deploy"]

FROM node:22.22.3-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
CMD ["node", "dist/main.js"]
