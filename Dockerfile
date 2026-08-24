# Build context is the repository root. This image is the API only; the web app
# is static files on Cloudflare Pages. No Railway/Cloudflare SDKs in the image.
#
#   docker build -t my-fit-track-api --build-arg APP_VERSION=dev .

FROM node:24-alpine AS build
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/config/package.json packages/config/package.json

RUN npm ci

COPY . .

RUN npm run contracts:build && npm run build --workspace @my-fit-track/api

FROM node:24-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

ENV NODE_ENV=production
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/config/package.json packages/config/package.json

RUN npm ci --omit=dev --workspace=@my-fit-track/api --workspace=@my-fit-track/contracts --include-workspace-root \
  && rm -rf apps/web node_modules/@angular node_modules/@angular-devkit node_modules/@angular/cli

COPY --from=build /app/packages/contracts/dist packages/contracts/dist
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY apps/api/scripts/docker-entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh \
  && cd apps/api \
  && npx prisma generate

WORKDIR /app/apps/api
EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
