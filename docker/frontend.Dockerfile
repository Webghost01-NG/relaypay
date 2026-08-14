# RelayPay Frontend Dashboard
# Multi-stage build: compile TypeScript → serve with lightweight Node

FROM node:20-alpine AS builder
WORKDIR /app

# Copy frontend package
COPY apps/frontend-dashboard/package.json apps/frontend-dashboard/package-lock.json ./
RUN npm ci

# Copy source and build
COPY apps/frontend-dashboard/ ./
ARG VITE_REGISTRY_ADDRESS
ARG VITE_FLARE_RPC_URL
ARG VITE_FDC_API_URL
ARG VITE_XRPL_WSS_URL
ARG VITE_CHAIN_ID=114
RUN npm run build

# Production stage — serve static files
FROM node:20-alpine AS production
WORKDIR /app
RUN npm install -g serve@14
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
