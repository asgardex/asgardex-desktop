#!/bin/bash

# Export dbus-launch
export $(dbus-launch)

# Print the DISPLAY environment variable
echo "DISPLAY: $DISPLAY"

# List running dbus processes
echo "Checking dbus processes..."
ps aux | grep dbus

# Check if /run/dbus directory exists
if [ -d /run/dbus ]; then
  echo "/run/dbus directory exists."
else
  echo "/run/dbus directory does not exist."
fi

# Check if system bus socket exists
if [ -S /run/dbus/system_bus_socket ]; then
  echo "System bus socket exists."
else
  echo "System bus socket does not exist."
fi

# Try to start dbus-daemon
echo "Starting dbus-daemon..."
dbus-daemon --system
if [ $? -eq 0 ]; then
  echo "dbus-daemon started successfully."
else
  echo "Failed to start dbus-daemon."
fi

# List running dbus processes again
echo "Rechecking dbus processes..."
ps aux | grep dbus

# Check journalctl logs for dbus if available
if command -v journalctl &> /dev/null; then
  echo "Checking dbus logs..."
  sudo journalctl -u dbus | tail -n 20
else
  echo "journalctl not available."
fi
