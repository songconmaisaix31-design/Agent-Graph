import { existsSync, mkdirSync, realpathSync } from 'node:fs'
import path from 'node:path'

export function createAgentGraphEnvironment(repoRoot, inherited = process.env) {
  const root = path.join(realpathSync.native(repoRoot), '.agent-graph', 'dev')
  const home = path.join(root, 'home')
  const userData = path.join(root, 'user-data')
  const env = Object.fromEntries(
    Object.entries(inherited).filter(([key]) => {
      const name = key.toUpperCase()
      return (
        !/^(ORCA_|CODEX_|CLAUDE_|ANTHROPIC_|OPENAI_|AGENT_GRAPH_|ELECTRON_|GIT_CONFIG|XDG_|COPILOT_|HERMES_|GROK_|OPENCLAW_|OPENCODE_|PI_|OMP_|PRIME_AGENT_|CLINE_|DEVIN_|KIMI_|MIMOCODE_|GEMINI_|QWEN_|CURSOR_|AIDER_|GOOSE_|SSH_|GH_|GLAB_|GITHUB_|GITLAB_)/.test(
          name
        ) &&
        !/(TOKEN|SECRET|API_KEY|CREDENTIAL)/.test(name) &&
        ![
          'HOME',
          'USERPROFILE',
          'HOMEDRIVE',
          'HOMEPATH',
          'APPDATA',
          'LOCALAPPDATA',
          'NODE_OPTIONS',
          'NODE_PATH',
          'ZDOTDIR',
          'BASH_ENV',
          'ENV',
          'TMPDIR',
          'TMP',
          'TEMP'
        ].includes(name)
      )
    })
  )
  return {
    root,
    home,
    userData,
    env: {
      ...env,
      HOME: home,
      USERPROFILE: home,
      ...(process.platform === 'win32'
        ? {
            HOMEDRIVE: path.parse(home).root.replace(/[\\/]$/, ''),
            HOMEPATH: home.slice(path.parse(home).root.length - 1)
          }
        : {}),
      APPDATA: path.join(home, 'AppData', 'Roaming'),
      LOCALAPPDATA: path.join(home, 'AppData', 'Local'),
      XDG_CONFIG_HOME: path.join(home, '.config'),
      XDG_CACHE_HOME: path.join(home, '.cache'),
      XDG_DATA_HOME: path.join(home, '.local', 'share'),
      XDG_STATE_HOME: path.join(home, '.local', 'state'),
      TEMP: path.join(root, 'tmp'),
      TMP: path.join(root, 'tmp'),
      TMPDIR: path.join(root, 'tmp'),
      GIT_CONFIG_GLOBAL: path.join(home, '.gitconfig'),
      GIT_CONFIG_NOSYSTEM: '1',
      AGENT_GRAPH_HOME_DIR: home,
      ORCA_DEV_USER_DATA_PATH: userData,
      ORCA_USER_DATA_PATH: userData,
      ORCA_DEV_INSTANCE_LABEL: 'Agent Graph',
      ORCA_DEV_DOCK_TITLE: 'Agent Graph Dev',
      ORCA_BACKGROUND_LAUNCH: '1',
      ORCA_E2E_ENFORCE_SINGLE_INSTANCE_LOCK: '1',
      ORCA_TELEMETRY_DISABLED: '1',
      ORCA_DIAGNOSTICS_DISABLED: '1',
      DO_NOT_TRACK: '1'
    }
  }
}

export function prepareAgentGraphDirectories(repoRoot, isolation) {
  const canonicalRepo = realpathSync.native(repoRoot)
  for (const directory of [
    isolation.root,
    isolation.home,
    isolation.userData,
    isolation.env.APPDATA,
    isolation.env.LOCALAPPDATA,
    isolation.env.TMP
  ]) {
    const relative = path.relative(canonicalRepo, directory)
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Agent Graph profile must stay inside its worktree')
    }
    let current = canonicalRepo
    for (const segment of relative.split(path.sep)) {
      current = path.join(current, segment)
      if (existsSync(current) && realpathSync.native(current) !== current) {
        throw new Error('Agent Graph profile must not traverse a link or junction')
      }
      mkdirSync(current, { recursive: true })
    }
  }
}
