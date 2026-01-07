# Build a lightweight image for the Expo notification backend (Node.js)
# Uses Alpine for a minimal runtime footprint
FROM node:20-alpine

# Set workdir
WORKDIR /app

# Install only production dependencies
# Copy only package.json/package-lock.json first to maximize layer caching
COPY package*.json ./

# If you have a lockfile, prefer npm ci for deterministic installs
# Fallback to npm install when no lock is present
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi \
    && npm cache clean --force

# Copy the rest of the app sources
COPY . .

# Run as non-root user for better security
# Create a non-root user and group with uid/gid 10001
RUN addgroup -g 10001 -S nodegrp \
    && adduser -S nodeusr -u 10001 -G nodegrp
USER 10001

# Environment setup
ENV NODE_ENV=production

# Health server listens on 3099
EXPOSE 3099

# Default command
CMD ["node", "index.js"]
