# Use a specific Node LTS version on Alpine for smaller image size
FROM node:20-alpine AS builder

# Declare build arguments received from docker-compose
ARG VITE_API_BASE_URL
ARG VITE_WS_BASE_URL

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install dependencies with caching
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit
RUN npm rebuild
# Copy the rest of the application code
COPY . .

# Build the application with caching
RUN --mount=type=cache,target=/app/node_modules/.cache \
    VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_WS_BASE_URL=${VITE_WS_BASE_URL} \
    npm run build

# --- Production Stage ---
FROM nginx:stable-alpine

# Copy built assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 (default for Nginx)
EXPOSE 80

# Command to run Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
