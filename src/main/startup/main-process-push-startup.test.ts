import { afterEach, expect, it, vi } from 'vitest'
import type { OrcaRuntimeRpcServer } from '../runtime/runtime-rpc'

vi.mock('../orca-profiles/profile-cloud-auth-config', () => ({ getOrcaPushGatewayUrl: vi.fn() }))
vi.mock('../runtime/push/desktop-push-service', () => ({ DesktopPushService: { create: vi.fn() } }))
vi.mock('./main-process-state', () => ({ mainProcessState: { runtime: {} } }))

import { getOrcaPushGatewayUrl } from '../orca-profiles/profile-cloud-auth-config'
import { DesktopPushService } from '../runtime/push/desktop-push-service'
import { startDesktopPushService } from './main-process-push-startup'

afterEach(() => vi.unstubAllEnvs())

it('does not initialize upstream push services in the Agent Graph dev profile', () => {
  vi.stubEnv('AGENT_GRAPH_HOME_DIR', 'isolated-home-fixture')
  const rpc = vi.fn<() => OrcaRuntimeRpcServer>()()
  startDesktopPushService(rpc)
  expect(getOrcaPushGatewayUrl).not.toHaveBeenCalled()
  expect(DesktopPushService.create).not.toHaveBeenCalled()
})
