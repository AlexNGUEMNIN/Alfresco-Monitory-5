# # Base image with Node.js and Alpine Linux
# FROM node:20.19.0-alpine

# # Set the working directory
# WORKDIR /app

# # Copy package definition files
# COPY package*.json ./

# # Install all dependencies (including dev)
# RUN npm install

# # Copy the rest of your Angular app
# COPY . .

# # Expose the default Angular dev server port
# EXPOSE 4200

# # Use npx to run Angular CLI from local node_modules
# CMD ["npx", "ng", "serve", "--host", "0.0.0.0"]


# Stage 1: Build the Angular app
# Stage 1: Build Angular
# Stage 1: Build Angular
FROM node:lts-alpine3.22 AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

# Stage 2: Serve with NGINX
FROM nginx:1.28-alpine3.21

# Remove default files
RUN rm -rf /usr/share/nginx/html/*

# Copy our SPA build artifacts
COPY --from=builder /app/dist/browser /usr/share/nginx/html

# Copy your custom nginx.conf to enable SPA fallback
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
