#!/bin/bash

echo "🔍 Debugging Pessoa Android App..."

# Set up paths
export ANDROID_HOME=~/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools

# Clear previous logs
adb logcat -c

echo "📱 Open the Pessoa app on your phone and try to login..."
echo "📊 Monitoring logs..."
echo "================================"

# Monitor specific logs with better filtering
adb logcat -v time | grep -E "(com.pessoa.app|Capacitor|chromium|Console|WebView|http://|Network|ERROR|WARN)" | while read -r line; do
    # Highlight errors in red
    if echo "$line" | grep -q "ERROR\|error\|Error"; then
        echo -e "\033[31m$line\033[0m"
    # Highlight warnings in yellow
    elif echo "$line" | grep -q "WARN\|warn\|Warning"; then
        echo -e "\033[33m$line\033[0m"
    # Highlight HTTP requests in blue
    elif echo "$line" | grep -q "http://\|https://"; then
        echo -e "\033[34m$line\033[0m"
    else
        echo "$line"
    fi
done