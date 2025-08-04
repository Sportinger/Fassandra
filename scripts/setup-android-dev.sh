#!/bin/bash

echo "🚀 Setting up Android development environment for Pessoa"
echo "======================================================"

# Install Java JDK 17
echo "📦 Installing Java JDK 17..."
sudo apt update
sudo apt install -y openjdk-17-jdk

# Install Android SDK command line tools
echo "📦 Installing Android SDK..."
cd ~
mkdir -p Android/Sdk
cd Android/Sdk

# Download Android command line tools
wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip commandlinetools-linux-11076708_latest.zip
rm commandlinetools-linux-11076708_latest.zip

# Create the expected directory structure
mkdir -p cmdline-tools/latest
mv cmdline-tools/* cmdline-tools/latest/ 2>/dev/null || true

# Set up environment variables
echo "🔧 Setting up environment variables..."
echo 'export ANDROID_HOME=$HOME/Android/Sdk' >> ~/.bashrc
echo 'export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools' >> ~/.bashrc
echo 'export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64' >> ~/.bashrc

# Source the updated bashrc
source ~/.bashrc

# Accept licenses and install required packages
echo "📦 Installing Android SDK packages..."
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin

yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"

# Install ADB for wireless debugging
echo "📱 Setting up ADB for wireless debugging..."
sudo apt install -y adb

echo "✅ Android development environment setup complete!"
echo ""
echo "🔧 Next steps:"
echo "1. Run: source ~/.bashrc"
echo "2. Get your phone's IP from Developer Options > Wireless debugging"
echo "3. We'll connect to your phone wirelessly"