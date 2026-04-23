#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { APP_CONSTANTS } from '../src/constants.js'
import {
  nowKrasnoyarskIso,
  formatKrasnoyarskHuman,
  KRASNOYARSK_TIME_ZONE_NAME,
  KRASNOYARSK_TIME_ZONE_LABEL,
} from '../src/utils/time.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

function safeWrite(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf-8')
  console.log(`[build-meta] updated: ${path.relative(ROOT, filePath)}`)
}

function resolveGitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString('utf-8')
      .trim()
  } catch {
    return 'unknown'
  }
}

function createBuildMeta() {
  const now = new Date()
  const gitHash = resolveGitHash()
  return {
    apiVersion: APP_CONSTANTS.apiVersion,
    appVersion: APP_CONSTANTS.appVersion,
    adminPanelVersion: APP_CONSTANTS.adminPanelVersion,
    frontendVersion: APP_CONSTANTS.frontendVersion,
    buildNumber: APP_CONSTANTS.buildNumber,
    gitCommitHash: gitHash,
    buildDate: nowKrasnoyarskIso(),
    buildDateHuman: formatKrasnoyarskHuman(now),
    buildTimeZone: KRASNOYARSK_TIME_ZONE_NAME,
    buildTimeZoneLabel: KRASNOYARSK_TIME_ZONE_LABEL,
  }
}

function writeBackendBuildInfo(meta) {
  const filePath = path.join(ROOT, 'src', 'build-info.generated.js')
  const content = `export const BUILD_INFO = ${JSON.stringify(
    {
      gitCommitHash: meta.gitCommitHash,
      buildDate: meta.buildDate,
      buildDateHuman: meta.buildDateHuman,
      buildTimeZone: meta.buildTimeZone,
      buildTimeZoneLabel: meta.buildTimeZoneLabel,
    },
    null,
    2,
  )}\n`

  safeWrite(filePath, content)
}

function writeAdminEnv(meta) {
  const filePath = path.join(ROOT, 'admin-panel', '.env.production.local')
  const lines = [
    `REACT_APP_API_VERSION=${meta.apiVersion}`,
    `REACT_APP_APP_VERSION=${meta.appVersion}`,
    `REACT_APP_ADMIN_PANEL_VERSION=${meta.adminPanelVersion}`,
    `REACT_APP_FRONTEND_VERSION=${meta.frontendVersion}`,
    `REACT_APP_BUILD_NUMBER=${meta.buildNumber}`,
    `REACT_APP_BUILD_DATE=${meta.buildDate}`,
    `REACT_APP_BUILD_DATE_HUMAN=${meta.buildDateHuman}`,
    `REACT_APP_GIT_COMMIT_HASH=${meta.gitCommitHash}`,
    `REACT_APP_BUILD_TIMEZONE=${meta.buildTimeZone}`,
    `REACT_APP_BUILD_TIMEZONE_LABEL=${meta.buildTimeZoneLabel}`,
    '',
  ]

  safeWrite(filePath, lines.join('\n'))
}

function writeWebEnv(meta) {
  const webPath = path.join(ROOT, 'mykhsu-web')
  if (!fs.existsSync(path.join(webPath, 'package.json'))) {
    console.log('[build-meta] skip mykhsu-web env: source is not available in workspace')
    return
  }

  const filePath = path.join(webPath, '.env.production.local')
  const lines = [
    `REACT_APP_APP_VERSION=${meta.frontendVersion}`,
    `REACT_APP_BUILD_VER=git-web-${meta.gitCommitHash}`,
    `REACT_APP_BUILD_DATE=${meta.buildDateHuman}`,
    `REACT_APP_BUILD_DATE_ISO=${meta.buildDate}`,
    `REACT_APP_BUILD_TIMEZONE=${meta.buildTimeZone}`,
    `REACT_APP_BUILD_TIMEZONE_LABEL=${meta.buildTimeZoneLabel}`,
    '',
  ]

  safeWrite(filePath, lines.join('\n'))
}

function main() {
  const args = new Set(process.argv.slice(2))
  const adminOnly = args.has('--admin-only')
  const webOnly = args.has('--web-only')

  const meta = createBuildMeta()

  if (!adminOnly && !webOnly) {
    writeBackendBuildInfo(meta)
    writeAdminEnv(meta)
    writeWebEnv(meta)
    return
  }

  if (adminOnly) {
    writeBackendBuildInfo(meta)
    writeAdminEnv(meta)
  }

  if (webOnly) {
    writeBackendBuildInfo(meta)
    writeWebEnv(meta)
  }
}

main()
