#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$ROOT_DIR/dist/native"

echo "Building FantasticalHelper.swift..."

mkdir -p "$DIST_DIR"

swiftc -O -o "$DIST_DIR/fantastical-helper" \
    "$SCRIPT_DIR/FantasticalHelper.swift" \
    -framework EventKit \
    -framework Foundation

echo "Built: $DIST_DIR/fantastical-helper"
