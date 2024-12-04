#!/bin/bash

# Export dbus-launch variables
eval $(dbus-launch --auto-syntax)
echo "DBUS_SESSION_BUS_ADDRESS: $DBUS_SESSION_BUS_ADDRESS"
echo "DBUS_SESSION_BUS_PID: $DBUS_SESSION_BUS_PID"

# Check for /run/dbus/system_bus_socket
if [ -S /run/dbus/system_bus_socket ]; then
  echo "/run/dbus/system_bus_socket exists."
else
  echo "/run/dbus/system_bus_socket does not exist. Creating it..."
  mkdir -p /run/dbus
  dbus-daemon --system
  if [ -S /run/dbus/system_bus_socket ]; then
    echo "System bus socket created."
  else
    echo "Failed to create system bus socket."
  fi
fi

# Ensure Xvfb starts correctly
echo "Starting Xvfb..."
Xvfb :0 -screen 0 1024x768x24 &

# Ensure Fluxbox starts correctly
echo "Starting Fluxbox..."
fluxbox &

# Ensure x11vnc starts correctly
echo "Starting x11vnc..."
x11vnc -display :0 -nopw -forever &

# Finally, start the Electron app
echo "Starting Electron app..."
DISPLAY=:0 yarn dev --no-sandbox
