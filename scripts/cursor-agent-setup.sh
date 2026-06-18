#!/usr/bin/env bash

set +e

echo "[cursor-setup] Installing dependencies with npm ci..."
npm ci
NPM_CI_STATUS=$?

if [ "$NPM_CI_STATUS" -ne 0 ]; then
  echo "[cursor-setup] ERROR: npm ci failed with exit code $NPM_CI_STATUS." >&2
else
  echo "[cursor-setup] npm ci completed successfully."
fi

echo "[cursor-setup] Verifying build with npm run build..."
npm run build
BUILD_STATUS=$?

if [ "$BUILD_STATUS" -ne 0 ]; then
  echo "[cursor-setup] ERROR: npm run build failed with exit code $BUILD_STATUS." >&2
else
  echo "[cursor-setup] npm run build completed successfully."
fi

if [ "$NPM_CI_STATUS" -ne 0 ] || [ "$BUILD_STATUS" -ne 0 ]; then
  echo "[cursor-setup] Setup reported errors, but the agent session will continue." >&2
fi

exit 0
