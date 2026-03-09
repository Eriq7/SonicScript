#!/bin/bash
# Run this script to generate icon files from icon.png
# Requires: ImageMagick (brew install imagemagick)
# Place a 1024x1024 icon.png in resources/ first

if [ -f "icon.png" ]; then
  # Create macOS tray icon (18x18 template)
  convert icon.png -resize 18x18 icon-tray.png
  # Create macOS app icon
  mkdir -p icon.iconset
  for size in 16 32 64 128 256 512; do
    convert icon.png -resize ${size}x${size} icon.iconset/icon_${size}x${size}.png
    convert icon.png -resize $((size*2))x$((size*2)) icon.iconset/icon_${size}x${size}@2x.png
  done
  iconutil -c icns icon.iconset -o icon.icns
  # Create Windows icon
  convert icon.png -resize 256x256 icon.ico
  echo "Icons created!"
else
  echo "Place a 1024x1024 icon.png in resources/ first"
fi
