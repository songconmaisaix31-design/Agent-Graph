#!/usr/bin/env node

import { spawn } from 'node:child_process'
import path from 'node:path'
import {
  createAgentGraphEnvironment,
  prepareAgentGraphDirectories
} from './agent-graph-environment.mjs'

if (process.argv.includes('--preview')) {
  throw new Error('Agent Graph packaged preview isolation is not ready. Use pnpm dev:agent-graph.')
}

const repoRoot = path.resolve(import.meta.dirname, '../..')
const isolation = createAgentGraphEnvironment(repoRoot)
prepareAgentGraphDirectories(repoRoot, isolation)

if (process.argv.includes('--check-isolation')) {
  console.log(
    JSON.stringify(
      {
        home: isolation.home,
        userData: isolation.userData,
        appData: isolation.env.APPDATA,
        localAppData: isolation.env.LOCALAPPDATA,
        background: true,
        telemetry: false,
        inheritedProviderOverrides: false
      },
      null,
      2
    )
  )
} else {
  await runNode('ensure-native-runtime.mjs', ['--runtime=electron'])
  await runNode('run-electron-vite-dev.mjs', process.argv.slice(2))
}

async function runNode(script, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(import.meta.dirname, script), ...args], {
      cwd: repoRoot,
      env: isolation.env,
      stdio: 'inherit',
      windowsHide: true
    })
    const stop = () => child.kill('SIGTERM')
    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)
    child.once('error', reject)
    child.once('exit', (code) => {
      process.removeListener('SIGINT', stop)
      process.removeListener('SIGTERM', stop)
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${script} exited with code ${code}`))
      }
    })
  })
}
