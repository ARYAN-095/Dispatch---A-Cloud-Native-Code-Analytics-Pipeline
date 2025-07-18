# Dockerfile for dispatch-api

# --- Stage 1: Build Stage ---
# Use an official Node.js image as a parent image.
# The 'alpine' version is a lightweight version of Linux, which is great for production.
FROM node:18-alpine AS builder

# Set the working directory inside the container.
WORKDIR /app

# Copy package.json and package-lock.json to the working directory.
COPY package*.json ./

# Install project dependencies.
RUN npm install

# Copy the rest of your application's source code.
COPY . .

# --- Stage 2: Production Stage ---
# Start from a fresh, even smaller base image for the final container.
FROM node:18-alpine

WORKDIR /app

# Copy the installed dependencies from the 'builder' stage.
COPY --from=builder /app/node_modules ./node_modules

# Copy the application code from the 'builder' stage.
COPY --from=builder /app .

# Expose port 8080 to the outside world.
EXPOSE 8080

# Define the command to run your app.
CMD [ "node", "index.js" ]
