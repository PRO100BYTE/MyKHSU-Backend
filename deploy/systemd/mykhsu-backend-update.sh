#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${MYKHSU_APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
BRANCH="${MYKHSU_GIT_BRANCH:-main}"
AUTO_UPDATE="${MYKHSU_GIT_AUTOUPDATE:-0}"
FORCE_UPDATE="${MYKHSU_GIT_FORCE_UPDATE:-0}"

if [[ "${AUTO_UPDATE}" != "1" && "${FORCE_UPDATE}" != "1" ]]; then
  echo "[mykhsu-update] Auto-update disabled; skipping."
  exit 0
fi

if [[ ! -d "${APP_DIR}/.git" ]]; then
  echo "[mykhsu-update] ${APP_DIR} is not a git repository; skipping."
  exit 0
fi

cd "${APP_DIR}"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "[mykhsu-update] Working tree is dirty; skipping auto-update to avoid losing local changes."
  exit 0
fi

echo "[mykhsu-update] Fetching origin/${BRANCH}..."
git fetch --prune origin "${BRANCH}"

LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse "origin/${BRANCH}")"

if [[ "${LOCAL_SHA}" == "${REMOTE_SHA}" && "${FORCE_UPDATE}" != "1" ]]; then
  echo "[mykhsu-update] Already up to date (${LOCAL_SHA})."
  exit 0
fi

echo "[mykhsu-update] Pulling latest changes..."
git pull --ff-only --recurse-submodules origin "${BRANCH}"

echo "[mykhsu-update] Installing production dependencies..."
npm ci --omit=dev

echo "[mykhsu-update] Building application..."
npm run build

echo "[mykhsu-update] Update completed."
