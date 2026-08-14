# RelayPay FDC Relayer Daemon
# Monitors XRPL → Fetches FDC proofs → Submits fulfillment to Flare EVM

FROM node:20-alpine AS builder
WORKDIR /app

# Build SDK dependency first
COPY packages/sdk/package.json packages/sdk/package-lock.json ./packages/sdk/
WORKDIR /app/packages/sdk
RUN npm ci
COPY packages/sdk/ ./
RUN npm run build

# Build relayer
WORKDIR /app/packages/fdc-relayer
COPY packages/fdc-relayer/package.json packages/fdc-relayer/package-lock.json ./
RUN npm ci
COPY packages/fdc-relayer/ ./
RUN npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

# Copy built SDK
COPY --from=builder /app/packages/sdk/dist ./packages/sdk/dist
COPY --from=builder /app/packages/sdk/package.json ./packages/sdk/
COPY --from=builder /app/packages/sdk/node_modules ./packages/sdk/node_modules

# Copy built relayer
COPY --from=builder /app/packages/fdc-relayer/dist ./packages/fdc-relayer/dist
COPY --from=builder /app/packages/fdc-relayer/package.json ./packages/fdc-relayer/
COPY --from=builder /app/packages/fdc-relayer/node_modules ./packages/fdc-relayer/node_modules

WORKDIR /app/packages/fdc-relayer
CMD ["node", "dist/src/cli.js"]
