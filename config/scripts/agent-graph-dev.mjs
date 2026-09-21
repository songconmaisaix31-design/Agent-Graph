#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import path from 'node:path'

const appData =
  process.env.APPDATA ?? path.join(process.env.USERPROFILE ?? process.env.HOME ?? '', 'AppData', 'Roaming')

const env = { ...process.env }
env.ORCA_DEV_USER_DATA_PATH ??= path.join(appData, 'agent-graph-dev')
env.ORCA_DEV_INSTANCE_LABEL ??= 'Agent Graph'
delete env.ORCA_BUILD_IDENTITY
delete env.ORCA_POSTHOG_WRITE_KEY
delete env.ORCA_DIAGNOSTICS_TOKEN_URL

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const result = spawnSync(command, ['run', 'dev'], { env, stdio: 'inherit' })

if (result.error) {
  throw result.error
}
process.exit(result.status ?? 1)
