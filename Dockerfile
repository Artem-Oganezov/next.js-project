# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_REVIVE_AD_PROVIDER=none
ARG NEXT_PUBLIC_GAM_AD_UNIT_PATH=
ARG NEXT_PUBLIC_GAM_NETWORK_ID=
ARG NEXT_PUBLIC_GAM_AD_UNIT_NAME=
ARG NEXT_PUBLIC_GAM_AD_FORMAT=interstitial
ARG NEXT_PUBLIC_REVIVE_AD_SLOT_ID=revive-ad-slot
# Real values are provided at runtime; placeholders prevent next build
# from failing env validation during prerender.
ENV MONGODB_URI=mongodb://build-placeholder:27017/build \
    AUTH_SECRET=build-placeholder-secret-32-characters!! \
    REDIS_URL=redis://build-placeholder:6379 \
    NEXT_PUBLIC_REVIVE_AD_PROVIDER=$NEXT_PUBLIC_REVIVE_AD_PROVIDER \
    NEXT_PUBLIC_GAM_AD_UNIT_PATH=$NEXT_PUBLIC_GAM_AD_UNIT_PATH \
    NEXT_PUBLIC_GAM_NETWORK_ID=$NEXT_PUBLIC_GAM_NETWORK_ID \
    NEXT_PUBLIC_GAM_AD_UNIT_NAME=$NEXT_PUBLIC_GAM_AD_UNIT_NAME \
    NEXT_PUBLIC_GAM_AD_FORMAT=$NEXT_PUBLIC_GAM_AD_FORMAT \
    NEXT_PUBLIC_REVIVE_AD_SLOT_ID=$NEXT_PUBLIC_REVIVE_AD_SLOT_ID
RUN npm run build
RUN npm run build:worker

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/dist/score-worker.cjs ./score-worker.cjs

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
