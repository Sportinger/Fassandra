#!/bin/bash

echo "📱 Connect to Android Device via Wireless ADB"
echo "==========================================="
echo ""
echo "On your Android phone:"
echo "1. Go to Settings > Developer Options > Wireless debugging"
echo "2. Tap 'Pair device with pairing code'"
echo "3. Note the pairing code and port (e.g., 192.168.1.100:39539)"
echo ""
read -p "Enter pairing IP:PORT (e.g., 192.168.1.100:39539): " PAIR_ADDRESS
read -p "Enter pairing code: " PAIR_CODE

# Pair the device
adb pair $PAIR_ADDRESS $PAIR_CODE

echo ""
echo "Now get the connection address:"
echo "In Wireless debugging, look for 'IP address & Port' (e.g., 192.168.1.100:37869)"
echo ""
read -p "Enter connection IP:PORT: " CONNECT_ADDRESS

# Connect to the device
adb connect $CONNECT_ADDRESS

# Verify connection
echo ""
echo "🔍 Checking connected devices..."
adb devices

echo ""
echo "✅ If you see your device listed above, you're connected!"
echo "📱 You can now run: npm run android"