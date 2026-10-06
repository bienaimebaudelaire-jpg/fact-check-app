import { describe, expect, it } from 'vitest'
import { buildOpenShellArgs, runOpenShell } from './openshell'

describe('openshell wrapper', () => {
  it('builds argv for sandbox create', () => {
    expect(buildOpenShellArgs({ kind: 'sandbox-create', from: 'base', name: 'fc', cpu: 2, memory: '4Gi' })).toEqual([
      'sandbox', 'create', '--from', 'base', '--name', 'fc', '--cpu', '2', '--memory', '4Gi',
    ])
  })

  it('rejects unsafe arguments', () => {
    expect(() => buildOpenShellArgs({ kind: 'sandbox-delete', name: 'a; rm -rf /' })).toThrow()
    expect(() => buildOpenShellArgs({ kind: 'sandbox-create', cpu: 0 })).toThrow()
    expect(() => buildOpenShellArgs({ kind: 'sandbox-exec', name: 'x', command: [] })).toThrow()
  })

  it('reports failures without throwing', async () => {
    const res = await runOpenShell({ kind: 'sandbox-list' }, { binary: 'os' }, async () => ({
      exitCode: 1, stdout: '', stderr: 'boom',
    }))
    expect(res).toMatchObject({ ok: false, exitCode: 1, argv: ['os', 'sandbox', 'list'] })
  })

  it('reports a missing binary as a failure', async () => {
    const res = await runOpenShell({ kind: 'sandbox-list' }, { binary: 'definitely-not-openshell' })
    expect(res.ok).toBe(false)
  })
})
