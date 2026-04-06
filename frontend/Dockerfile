# Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build -- --configuration production

# Runtime
FROM nginx:1.25-alpine AS runtime

# Remove default nginx content
RUN rm -rf /usr/share/nginx/html/*

# Copy built Angular app
COPY --from=builder /app/dist/frontend/browser /usr/share/nginx/html

# Custom nginx config: serve SPA, proxy /api and /socket.io to backend
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]