import { describe, it, expect, afterEach } from 'vitest'
import {
  mkdtempSync,
  mkdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  existsSync,
  readFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  createAgentGraphEnvironment,
  prepareAgentGraphDirectories
} from './agent-graph-environment.mjs'

const directories = []
function fixture() {
  const directory = realpathSync.native(mkdtempSync(path.join(tmpdir(), 'agent-graph-env-')))
  directories.push(directory)
  return directory
}
afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('Agent Graph development isolation', () => {
  it('routes every desktop dev entrypoint through the isolated launcher', () => {
    const { scripts } = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
    )
    for (const name of ['dev', 'dev:agent-graph', 'dev-stable-name', 'start']) {
      expect(scripts[name]).toMatch(/^node config\/scripts\/agent-graph-dev\.mjs(?: |$)/)
    }
    expect(scripts.start).toContain('--preview')
  })

  it('refuses unvalidated built preview before native or Electron startup', () => {
    const child = spawnSync(
      process.execPath,
      [path.join(import.meta.dirname, 'agent-graph-dev.mjs'), '--preview'],
      {
        encoding: 'utf8',
        windowsHide: true
      }
    )
    expect(child.status).toBe(1)
    expect(child.stderr).toContain('packaged preview isolation is not ready')
  })

  it('drops supported provider data roots before hooks or transcript scanners can see them', () => {
    const overrides = Object.fromEntries(
      [
        'COPILOT_HOME',
        'HERMES_HOME',
        'GROK_HOME',
        'OPENCLAW_STATE_DIR',
        'OPENCODE_DB',
        'OPENCODE_CONFIG_DIR',
        'PI_CODING_AGENT_DIR',
        'PI_CONFIG_DIR',
        'PI_PROFILE',
        'OMP_CODING_AGENT_DIR',
        'OMP_PROFILE',
        'PRIME_AGENT_CODING_AGENT_DIR',
        'PRIME_AGENT_CODING_AGENT_SESSION_DIR',
        'PRIME_AGENT_SESSION_DIR',
        'CLINE_SESSION_DATA_DIR',
        'DEVIN_HOME',
        'KIMI_CODE_HOME',
        'MIMOCODE_HOME',
        'SSH_AUTH_SOCK',
        'GH_CONFIG_DIR'
      ].map((key) => [key, '/daily-provider-data'])
    )
    const isolation = createAgentGraphEnvironment(fixture(), overrides)
    for (const key of Object.keys(overrides)) {
      expect(isolation.env[key]).toBeUndefined()
    }
  })

  it('discards inherited Orca routing, provider credentials and home overrides', () => {
    const repo = fixture()
    const isolation = createAgentGraphEnvironment(repo, {
      ORCA_USER_DATA_PATH: '/daily-orca',
      ORCA_AGENT_HOOK_ENDPOINT: '/daily-endpoint',
      ORCA_DEV_USER_DATA_PATH: '/daily-dev',
      CODEX_HOME: '/daily-codex',
      CLAUDE_CONFIG_DIR: '/daily-claude',
      OPENAI_API_KEY: 'fixture-key',
      orca_cloud_api_url: 'https://invalid.example',
      NODE_OPTIONS: '--require=/foreign.js',
      USERPROFILE: '/daily-home',
      APPDATA: '/daily-appdata',
      ELECTRON_RUN_AS_NODE: '1'
    })
    expect(isolation.env.ORCA_USER_DATA_PATH).toBe(
      path.join(repo, '.agent-graph', 'dev', 'user-data')
    )
    for (const key of [
      'CODEX_HOME',
      'CLAUDE_CONFIG_DIR',
      'OPENAI_API_KEY',
      'ORCA_AGENT_HOOK_ENDPOINT',
      'orca_cloud_api_url',
      'NODE_OPTIONS',
      'ELECTRON_RUN_AS_NODE'
    ]) {
      expect(isolation.env[key]).toBeUndefined()
    }
    expect(isolation.env.ORCA_TELEMETRY_DISABLED).toBe('1')
    expect(isolation.env.ORCA_E2E_ENFORCE_SINGLE_INSTANCE_LOCK).toBe('1')
  })

  it('a real child resolves home and temporary files within this worktree', () => {
    const repo = fixture()
    const isolation = createAgentGraphEnvironment(repo)
    prepareAgentGraphDirectories(repo, isolation)
    const child = spawnSync(
      process.execPath,
      [
        '-e',
        'console.log(JSON.stringify({ home: require("node:os").homedir(), temp: require("node:os").tmpdir() }))'
      ],
      { env: isolation.env, encoding: 'utf8', windowsHide: true }
    )
    expect(child.status).toBe(0)
    expect(JSON.parse(child.stdout)).toEqual({ home: isolation.home, temp: isolation.env.TMP })
  })

  it('refuses a profile junction before writing into its target', () => {
    const repo = fixture()
    const target = fixture()
    const isolation = createAgentGraphEnvironment(repo)
    symlinkSync(
      target,
      path.join(repo, '.agent-graph'),
      process.platform === 'win32' ? 'junction' : 'dir'
    )
    expect(() => prepareAgentGraphDirectories(repo, isolation)).toThrow(/link or junction/)
    expect(existsSync(path.join(target, 'dev'))).toBe(false)
  })

  it('keeps profiles distinct across worktrees and stable across restarts', () => {
    const first = fixture()
    const second = fixture()
    mkdirSync(path.join(first, '.agent-graph'))
    expect(createAgentGraphEnvironment(first).userData).not.toBe(
      createAgentGraphEnvironment(second).userData
    )
    expect(createAgentGraphEnvironment(first).userData).toBe(
      createAgentGraphEnvironment(first).userData
    )
  })
})
