import { useState } from 'react'
import { updateMe } from '../api/auth'
import ErrorBanner from '../components/ErrorBanner'
import { useSession } from '../context/SessionContext'
import { isYes } from '../lib/codes'

const SETTINGS = [
  ['notifyApprove', 'A deployment waits for my approval'],
  ['notifyOwn', 'A deployment I requested is decided, ends or expires'],
  ['notifyApp', 'A deployment of an application I own ends'],
]

// U2: the address LWD mails to, and which mails the user wants.
// /profile. The session's GET /me has the current values.
export default function Profile() {
  const { user, reload } = useSession()
  const [values, setValues] = useState(() => Object.fromEntries(SETTINGS.map(([f]) => [f, isYes(user[f])])))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const changed = SETTINGS.some(([f]) => values[f] !== isYes(user[f]))

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await updateMe(Object.fromEntries(SETTINGS.map(([f]) => [f, values[f] ? 'Y' : 'N'])))
      await reload()
      setSaved(true)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-[17px] font-medium">Profile</h1>
        <p className="text-[13px] text-fg-2">
          Signed in as <span className="font-mono">{user.userID}</span>.
        </p>
      </header>
      <section className="card flex max-w-xl flex-col gap-2 p-6 text-[13px]" aria-label="Email address">
        <h2 className="text-[15px] font-medium">Email address</h2>
        {user.email ? (
          <p className="font-mono">{user.email}</p>
        ) : (
          <p className="text-warning-fg">LWD has no email address for you, so it can&apos;t send you mail.</p>
        )}
        <p className="text-fg-3">
          LWD copies it from your RACF userid (the WAEMAIL field) once a day. To change it, ask for it to be changed in
          RACF.
        </p>
      </section>
      <form onSubmit={save} className="card flex max-w-xl flex-col gap-3 p-6 text-[13px]">
        <h2 className="text-[15px] font-medium">Mail me when</h2>
        {error && <ErrorBanner error={error} />}
        {SETTINGS.map(([field, text]) => (
          <label key={field} className="flex items-center gap-2">
            <input type="checkbox" checked={values[field]}
              onChange={(e) => { setValues((v) => ({ ...v, [field]: e.target.checked })); setSaved(false) }} />
            {text}
          </label>
        ))}
        <p className="text-fg-3">The web UI always shows the same: mail only saves you from looking.</p>
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={busy || !changed}>{busy ? 'Saving…' : 'Save'}</button>
          {saved && <span role="status" className="text-success-fg">Saved</span>}
        </div>
      </form>
    </>
  )
}
