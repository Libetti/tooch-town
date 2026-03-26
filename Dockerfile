FROM node:22-alpine AS builder
WORKDIR /app
ARG PUBLIC_MAPTILER_KEY
ENV PUBLIC_MAPTILER_KEY=$PUBLIC_MAPTILER_KEY
COPY package*.json ./
RUN npm ci
COPY . .
RUN test -n "$PUBLIC_MAPTILER_KEY" || (echo "Missing required build arg: PUBLIC_MAPTILER_KEY" && exit 1)
RUN npm run prepare
RUN npm run build
RUN npm prune --production

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/build build/
COPY --from=builder /app/node_modules node_modules/
COPY package.json .
EXPOSE 3000
ENV NODE_ENV=production
CMD [ "node", "build" ]