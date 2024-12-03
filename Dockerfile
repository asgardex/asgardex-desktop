# Use a base image with Node.js
FROM node:20.17.0

# Create a non-root user and group
RUN addgroup --system appgroup && adduser --system appuser --ingroup appgroup

# Set the working directory
WORKDIR /app

# Install necessary Linux dependencies for Electron
RUN apt-get update && apt-get install -y \
    # Core libraries
    libudev-dev \
    libusb-1.0-0-dev \
    libnss3 \
    curl \
    ca-certificates \
    # GUI-related libraries
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    libxshmfence1 \
    # Audio and rendering libraries
    libasound2 \
    libpangocairo-1.0-0 \
    libpango1.0-0 \
    libcups2 \
    libexpat1 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    # Utilities
    xdg-utils \
    # Clean up after installation
    --no-install-recommends && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Enable Corepack for managing Yarn
RUN corepack enable

# Ensure Corepack uses the correct version of Yarn
RUN corepack prepare yarn@4.2.2 --activate

# Set environment variables (optional)
COPY .env ./
RUN echo "source .env" >> ~/.bashrc

# Copy package files
COPY package.json yarn.lock ./

# Copy the rest of the application files
COPY . ./

# Install project dependencies
RUN yarn install --immutable

# Expose the port your app runs on
EXPOSE 3000

# Add a healthcheck to verify the app's state
HEALTHCHECK --interval=5m --timeout=3s \
  CMD curl -f http://localhost:3000/health || exit 1

# Switch to the non-root user for security
USER appuser

# Command to start the application in development mode
CMD ["yarn", "dev", "--no-sandbox"]
