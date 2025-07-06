# 1. Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install

# 2. Build the application
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# This secret is exposed only during build time.
# You will need to add it to your CapRover deployment environment variables.
ARG GOOGLE_CLIENT_ID
ARG GOOGLE_CLIENT_SECRET
RUN npm run build

# 3. Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# You will need to add your environment variables to your CapRover app settings.
# For example: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, etc.
CMD ["node", "server.js"] 