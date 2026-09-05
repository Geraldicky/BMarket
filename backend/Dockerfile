FROM node:22.22.3-alpine AS deps

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm ci


FROM deps AS build

COPY . .

RUN npm run db:generate
RUN npm run build


# One-shot migration image.
# Dev dependencies tetap dipertahankan karena Prisma CLI ada di devDependencies.
FROM deps AS migrate

COPY prisma ./prisma

CMD ["npx", "prisma", "migrate", "deploy"]


FROM node:22.22.3-alpine AS runtime

RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

# Copy Prisma Client yang sudah digenerate pada build stage.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

CMD ["node", "dist/src/main.js"]