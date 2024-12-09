# Use a base image with Node.js
FROM node:20.17.0

# Add metadata labels
LABEL vendor="ASGARDEX"
LABEL maintainer="Asgardex"
LABEL version="0.0.1"
LABEL title="ASGARDEX Development Environment"
LABEL description="Docker image for ASGARDEX development environment"
LABEL license="MIT"
LABEL source="https://github.com/asgardex/asgardex-desktop"

# Create a non-root user and assign a home directory
RUN addgroup --system appgroup && adduser --system --home /home/appuser appuser --ingroup appgroup

# Set the working directory
WORKDIR /app

# Set HOME environment variable for appuser
ENV HOME=/home/appuser

# Install necessary Linux dependencies for Electron
RUN apt-get update && apt-get install -y \
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
    # GUI Loading
    libgl1-mesa-glx \
    libdbus-1-3 \
    xvfb \
    x11vnc \
    x11-xserver-utils \
    fluxbox \
    dbus-x11 \
    xfce4 \
    xfce4-goodies \
    tightvncserver \
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
RUN echo "source .env" >> /etc/bash.bashrc

# Copy package files
COPY package.json yarn.lock ./

# Copy the rest of the application files
COPY . ./

# Install project dependencies
RUN yarn install --immutable

RUN yarn prebuild

# Change ownership of directories
RUN chown appuser:appgroup /app /home/appuser

# Change ownership of Git directory
RUN chown -R appuser:appgroup /app/.git

# Change ownership of other required directories
RUN chown -R appuser:appgroup /home/appuser/.cache
RUN chmod -R 755 /home/appuser/.cache

# Ensure /tmp/.X11-unix directory is created and accessible
RUN mkdir -p /tmp/.X11-unix && chmod 1777 /tmp/.X11-unix

# Create and set permissions for Asgardex folders
RUN mkdir -p /app/node_modules/.cache && chown -R appuser:appgroup /app/node_modules/.cache
RUN mkdir -p /home/appuser/.config/ASGARDEX/storage && chown -R appuser:appgroup /home/appuser/.config/ASGARDEX

RUN mkdir ~/.vnc

# Expose the port your app runs on
EXPOSE 3000

# Expose the VNC port
EXPOSE 5901

# Add a healthcheck to verify the app's state
HEALTHCHECK --interval=5m --timeout=3s \
  CMD curl -f http://localhost:3000/health || exit 1

# Copy the debug script
COPY debug_dbus.sh /app/debug_dbus.sh

# Make the script executable
RUN chmod +x /app/debug_dbus.sh

# Switch to the non-root user for security
USER appuser

# Use the debug script to start the application
CMD ["/app/debug_dbus.sh"]


# Set up VNC and start the application in development mode
#CMD ["sh", "-c", "export $(dbus-launch) && echo $DISPLAY && Xvfb :0 -screen 0 1024x768x24 & fluxbox & x11vnc -display :0 -nopw -forever & DISPLAY=:0 yarn dev --no-sandbox"]
