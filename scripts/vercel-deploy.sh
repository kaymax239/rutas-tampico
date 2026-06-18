#!/usr/bin/env bash

set +e

VERCEL_PROJECT="${VERCEL_PROJECT:-rutas-tampico}"
VERCEL_SCOPE="${VERCEL_SCOPE:-victors-projects-cfa2b71b}"

if [ -z "${VERCEL_TOKEN:-}" ]; then
  echo "[vercel-deploy] ERROR: VERCEL_TOKEN is not configured." >&2
  echo "[vercel-deploy] Create a Vercel token and export it before deploying:" >&2
  echo "[vercel-deploy]   export VERCEL_TOKEN=your_token_here" >&2
  echo "[vercel-deploy] Then run: npm run deploy:vercel" >&2
  exit 1
fi

echo "[vercel-deploy] Linking project '$VERCEL_PROJECT' in scope '$VERCEL_SCOPE'..."
npx vercel link \
  --yes \
  --project "$VERCEL_PROJECT" \
  --scope "$VERCEL_SCOPE" \
  --token "$VERCEL_TOKEN"
LINK_STATUS=$?

if [ "$LINK_STATUS" -ne 0 ]; then
  echo "[vercel-deploy] ERROR: vercel link failed with exit code $LINK_STATUS." >&2
  exit "$LINK_STATUS"
fi

echo "[vercel-deploy] Pulling production environment settings..."
npx vercel pull \
  --yes \
  --environment=production \
  --scope "$VERCEL_SCOPE" \
  --token "$VERCEL_TOKEN"
PULL_STATUS=$?

if [ "$PULL_STATUS" -ne 0 ]; then
  echo "[vercel-deploy] ERROR: vercel pull failed with exit code $PULL_STATUS." >&2
  exit "$PULL_STATUS"
fi

echo "[vercel-deploy] Deploying to Vercel production..."
npx vercel \
  --prod \
  --yes \
  --scope "$VERCEL_SCOPE" \
  --token "$VERCEL_TOKEN"
DEPLOY_STATUS=$?

if [ "$DEPLOY_STATUS" -ne 0 ]; then
  echo "[vercel-deploy] ERROR: production deploy failed with exit code $DEPLOY_STATUS." >&2
  exit "$DEPLOY_STATUS"
fi

echo "[vercel-deploy] Production deploy completed successfully."
