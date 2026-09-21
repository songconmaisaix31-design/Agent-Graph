import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: () => tmpdir(), getAppPath: () => tmpdir() }
}))

import { CliInstaller } from './cli-installer'
import { WslCliInstaller } from './wsl-cli-installer'
import { makeFixture } from './cli-installer-test-fixtures'

afterEach(() => vi.unstubAllEnvs())

describe('Agent Graph global CLI isolation', () => {
  it('blocks WSL registration, removal and repair without contacting the distro', async () => {
    const wslRunner = vi.fn()
    const hostStatus = vi.fn()
    const installer = new WslCliInstaller({
      platform: 'win32',
      distro: 'fixture-distro',
      hostInstaller: { getStatus: hostStatus },
      wslRunner
    })
    vi.stubEnv('AGENT_GRAPH_HOME_DIR', 'isolated-home-fixture')
    expect((await installer.getStatus()).supported).toBe(false)
    expect((await installer.remove()).supported).toBe(false)
    expect(await installer.repairManagedRegistration()).toMatchObject({
      changed: false,
      managed: false
    })
    await expect(installer.install()).rejects.toThrow(/Agent Graph/)
    await expect(
      installer.install({ ...(await installer.getStatus()), supported: true })
    ).rejects.toThrow(/Agent Graph/)
    expect(wslRunner).not.toHaveBeenCalled()
    expect(hostStatus).not.toHaveBeenCalled()
  })

  it.each(['install', 'remove'] as const)(
    'blocks %s before resolving or writing registrations',
    async (operation) => {
      const fixture = await makeFixture()
      const commandPath = join(fixture.root, 'global-bin', 'orca.cmd')
      const installer = new CliInstaller({
        platform: 'win32',
        isPackaged: false,
        userDataPath: fixture.userDataPath,
        appPath: fixture.appPath,
        execPath: process.execPath,
        commandPathOverride: commandPath
      })
      const status = vi.spyOn(installer, 'getStatus')
      vi.stubEnv('AGENT_GRAPH_HOME_DIR', join(fixture.root, 'home'))
      try {
        await expect(installer[operation]()).rejects.toThrow(/Agent Graph/)
        expect(status).not.toHaveBeenCalled()
        expect(existsSync(commandPath)).toBe(false)
        expect(existsSync(fixture.userDataPath)).toBe(false)
      } finally {
        await rm(fixture.root, { recursive: true, force: true })
      }
    }
  )
})
