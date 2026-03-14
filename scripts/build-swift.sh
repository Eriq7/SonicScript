#!/bin/bash
#
# build-swift.sh — Compiles SonicScriptHelper.swift into a signed .app bundle,
#                  then patches Electron's Info.plist with privacy descriptions.
#
# Main steps:
#   1. Resolve SDK path: prefer MacOSX15.5.sdk; fall back to xcrun default
#      (SDK pin is required because Swift 6.1.x is incompatible with the
#      macOS 26.x beta SDK that ships with Xcode 26 pre-release)
#   2. Create .app bundle structure (Contents/MacOS/) and copy helper-info.plist
#      as Contents/Info.plist — bundle format is required for macOS TCC recognition
#   3. swiftc -O: compile with frameworks Foundation, Speech, AVFoundation
#   4. codesign --force --deep --sign - with entitlements.helper.plist (ad-hoc)
#   5. Patch Electron.app/Contents/Info.plist:
#        NSMicrophoneUsageDescription
#        NSSpeechRecognitionUsageDescription
#      Re-sign Electron.app after patching (TCC reads the plist from the signed bundle)
#
# Usage:
#   npm run build:swift   (invoked via package.json scripts)
#
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SRC="$PROJECT_ROOT/src/main/speech/SonicScriptHelper.swift"
BUNDLE="$PROJECT_ROOT/resources/SonicScriptHelper.app"
BIN="$BUNDLE/Contents/MacOS/SonicScriptHelper"

echo "Compiling Swift helper..."
# Use a compatible SDK (Swift 6.1.x needs macOS 15.x SDK, not 26.x beta)
SDK_PATH="/Library/Developer/CommandLineTools/SDKs/MacOSX15.5.sdk"
if [ ! -d "$SDK_PATH" ]; then
  SDK_PATH=$(xcrun --sdk macosx --show-sdk-path 2>/dev/null || echo "")
fi

# Create .app bundle structure for proper TCC recognition
mkdir -p "$BUNDLE/Contents/MacOS"
cp "$PROJECT_ROOT/resources/helper-info.plist" "$BUNDLE/Contents/Info.plist"

swiftc -O "$SRC" \
  -o "$BIN" \
  ${SDK_PATH:+-sdk "$SDK_PATH"} \
  -framework Foundation \
  -framework Speech \
  -framework AVFoundation

echo "Swift helper compiled: $BIN"

# Sign the .app bundle with entitlements
ENTITLEMENTS="$PROJECT_ROOT/resources/entitlements.helper.plist"
codesign --force --deep --sign - --entitlements "$ENTITLEMENTS" "$BUNDLE"
echo "Swift helper bundle signed: $BUNDLE"

# Patch Electron's Info.plist for dev mode (TCC checks responsible process)
ELECTRON_PLIST="$(node -e "const p=require('electron');const path=require('path');console.log(path.join(path.dirname(p),'../Info.plist'))" 2>/dev/null)"
if [ -n "$ELECTRON_PLIST" ] && [ -f "$ELECTRON_PLIST" ]; then
  /usr/libexec/PlistBuddy -c "Add :NSSpeechRecognitionUsageDescription string 'SonicScript uses speech recognition to convert your voice to text.'" "$ELECTRON_PLIST" 2>/dev/null || \
  /usr/libexec/PlistBuddy -c "Set :NSSpeechRecognitionUsageDescription 'SonicScript uses speech recognition to convert your voice to text.'" "$ELECTRON_PLIST" 2>/dev/null
  /usr/libexec/PlistBuddy -c "Add :NSMicrophoneUsageDescription string 'SonicScript needs microphone access to transcribe your speech.'" "$ELECTRON_PLIST" 2>/dev/null || \
  /usr/libexec/PlistBuddy -c "Set :NSMicrophoneUsageDescription 'SonicScript needs microphone access to transcribe your speech.'" "$ELECTRON_PLIST" 2>/dev/null
  echo "Patched Electron Info.plist for dev mode"
  # Re-sign Electron.app after Info.plist change (required for TCC to read updated plist)
  ELECTRON_APP="$(dirname "$(dirname "$ELECTRON_PLIST")")"
  codesign --force --deep --sign - "$ELECTRON_APP" 2>/dev/null && echo "Re-signed Electron.app"
fi
