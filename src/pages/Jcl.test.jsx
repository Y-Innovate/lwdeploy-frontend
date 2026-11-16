import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { setNavigator, setUnauthorizedHandler } from '../api/client'
import { stubBackend } from '../test/backend'
import { openApp } from '../test/render'

beforeEach(() => {
  setNavigator(vi.fn())
  setUnauthorizedHandler(() => {})
})
afterEach(() => {
  setNavigator(null)
  vi.unstubAllGlobals()
})

it('shows the frozen JCL with line numbers, and switches between jobs', async () => {
  stubBackend({ user: 'APR0001' })
  openApp('/jcl?deplID=7&jobNo=1')
  expect(await screen.findByRole('heading', { name: 'Job 1: Copy load modules' })).toBeInTheDocument()
  expect(screen.getByText('//IN DD DISP=SHR,DSN=LWD.DEMO.V100.LOAD')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Deployment 7' })).toHaveAttribute('href', '/lwdeploy/deployment?deplID=7')
  const nav = screen.getByRole('navigation', { name: 'Jobs' })
  await userEvent.click(within(nav).getByRole('link', { name: 'Job 2' }))
  expect(await screen.findByRole('heading', { name: 'Job 2: Refresh CICS' })).toBeInTheDocument()
  expect(screen.getByText("//REFRESH EXEC PGM=DFHCSDUP,PARM='CSD(READONLY)'")).toBeInTheDocument()
})

it('says not found for a job that does not exist or without a role', async () => {
  stubBackend({ user: 'NOROLE1' })
  openApp('/jcl?deplID=7&jobNo=1')
  expect(await screen.findByText(/doesn.t exist, or you have no role/)).toBeInTheDocument()
})
