import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setNavigator, setUnauthorizedHandler } from '../api/client'
import { stubBackend } from '../test/backend'
import { openApp } from '../test/render'

// F10: the templates tab and the template page (O2)
beforeEach(() => {
  setNavigator(vi.fn())
  setUnauthorizedHandler(() => {})
})
afterEach(() => {
  setNavigator(null)
  vi.unstubAllGlobals()
})

const editor = () => screen.findByRole('textbox', { name: 'JCL' })
// userEvent.type reads { and [ as keys
const typeText = (el, text) => userEvent.type(el, text.replaceAll('{', '{{').replaceAll('[', '[['))

describe('templates tab', () => {
  it('lists the templates in order, read-only for members', async () => {
    stubBackend({ user: 'DEV0001' })
    openApp('/app?appID=1&tab=templates')
    const link = await screen.findByRole('link', { name: 'Copy load modules' })
    expect(link).toHaveAttribute('href', '/lwdeploy/template?templateID=1')
    expect(screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[1].textContent))
      .toEqual(['Copy load modules', 'Refresh CICS'])
    expect(screen.queryByRole('button', { name: 'Add template' })).not.toBeInTheDocument()
  })

  it('adds a template for an owner and opens it, with the note that deployments wait for its JCL', async () => {
    stubBackend({ user: 'OWN0001' })
    openApp('/app?appID=1&tab=templates')
    await userEvent.click(await screen.findByRole('button', { name: 'Add template' }))
    await userEvent.type(screen.getByLabelText('Name'), 'Smoke test')
    await userEvent.click(screen.getByRole('button', { name: 'Add template' }))
    expect(await screen.findByRole('heading', { name: 'Smoke test' })).toBeInTheDocument()
    expect(screen.getByText(/no JCL yet/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: /DEMO templates/ }))
    expect(await screen.findByText(/Smoke test has no JCL yet: deployments are refused/)).toBeInTheDocument()
  })

  it('reorders, edits and deletes', async () => {
    const { db } = stubBackend({ user: 'OWN0001' })
    openApp('/app?appID=1&tab=templates')
    await userEvent.click(await screen.findByRole('button', { name: 'Move Refresh CICS up' }))
    await vi.waitFor(() => expect(screen.getAllByRole('link', { name: /Copy|Refresh/ }).map((l) => l.textContent))
      .toEqual(['Refresh CICS', 'Copy load modules']))
    await userEvent.click(screen.getByRole('button', { name: 'Edit Copy load modules' }))
    const rc = screen.getByLabelText('Highest RC')
    await userEvent.clear(rc)
    await userEvent.type(rc, '0')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await vi.waitFor(() => expect(db.data.templates.find((t) => t.templateID === 1).maxRC).toBe(0))
    await userEvent.click(screen.getByRole('button', { name: 'Delete Copy load modules' }))
    expect(screen.getByText(/Its revisions stay/)).toBeInTheDocument()
    await userEvent.click(screen.getByText('Delete Copy load modules', { selector: 'button' }))
    await vi.waitFor(() => expect(screen.queryByRole('link', { name: 'Copy load modules' })).not.toBeInTheDocument())
  })
})

describe('template page', () => {
  it('shows members the current JCL read-only, and the revisions', async () => {
    stubBackend({ user: 'DEV0001' })
    openApp('/template?templateID=1')
    expect(await screen.findByRole('heading', { name: 'Copy load modules' })).toBeInTheDocument()
    expect(await screen.findByText('COPY INDD=((IN,R)),OUTDD=OUT', { exact: false })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'JCL' })).not.toBeInTheDocument()
    expect(await screen.findByText('Target library from a variable')).toBeInTheDocument()
  })

  it('saves new JCL as a revision and shows its warning', async () => {
    const { db } = stubBackend({ user: 'OWN0001' })
    openApp('/template?templateID=1')
    const jcl = await editor()
    await vi.waitFor(() => expect(jcl.value).toContain('IEBCOPY'))
    await userEvent.clear(jcl)
    await typeText(jcl, '//COPY EXEC PGM=IEBCOPY\n//OUT DD DSN=${NEWLIB},DISP=SHR')
    expect(screen.getByText(/2 lines of at most 300/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Change note'), 'New library')
    await userEvent.click(screen.getByRole('button', { name: 'Save as a new revision' }))
    expect(await screen.findByText(/Saved as revision 4, 2 lines\. 1 warning, the first: Line 2: \$\{NEWLIB\} is defined at no level yet/))
      .toBeInTheDocument()
    expect(db.data.templates.find((t) => t.templateID === 1).currentRev).toBe(4)
    expect(await screen.findByText('New library')).toBeInTheDocument()
  })

  it('shows the refusal of a JOB statement, naming the line, and keeps the text', async () => {
    stubBackend({ user: 'OWN0001' })
    openApp('/template?templateID=2')
    const jcl = await editor()
    await vi.waitFor(() => expect(jcl.value).toContain('DFHCSDUP'))
    await userEvent.type(jcl, '{Control>}{Home}{/Control}//LWD1 JOB (1),CLASS=A\n')
    await userEvent.click(screen.getByRole('button', { name: 'Save as a new revision' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Not saved: Line 1: a JOB statement; LWD writes it')
    expect(jcl.value).toMatch(/^\/\/LWD1 JOB/)
  })

  it('shows an older revision, and compares two side by side', async () => {
    stubBackend({ user: 'DEV0001' })
    openApp('/template?templateID=1&revision=1')
    expect(await screen.findByRole('heading', { name: 'Revision 1' })).toBeInTheDocument()
    expect(await screen.findByText('DSN=LWD.DEMO.LOAD', { exact: false })).toBeInTheDocument()
    const compare = await screen.findByRole('region', { name: 'Compare revisions' })
    expect(await within(compare).findByText('1 changed line')).toBeInTheDocument()
    expect(compare.querySelector('[data-kind="del"]').textContent).toBe('  COPY INDD=IN,OUTDD=OUT')
    expect(compare.querySelector('[data-kind="add"]').textContent).toBe('  COPY INDD=((IN,R)),OUTDD=OUT')
    await userEvent.selectOptions(within(compare).getByLabelText('From'), 'Revision 1')
    expect(await within(compare).findByText('2 changed lines')).toBeInTheDocument()
  })

  it('is linked from the frozen JCL of a deployment', async () => {
    stubBackend({ user: 'DEV0001' })
    openApp('/jcl?deplID=7&jobNo=1')
    expect(await screen.findByRole('link', { name: 'revision 3 of the template' }))
      .toHaveAttribute('href', '/lwdeploy/template?templateID=1&revision=3')
  })
})
