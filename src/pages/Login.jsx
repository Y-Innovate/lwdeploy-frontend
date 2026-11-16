import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ENTRA_SIGN_IN_URL } from '../api/auth'
import { BASE, goTo } from '../api/client'
import ErrorBanner from '../components/ErrorBanner'
import { useSession } from '../context/SessionContext'
import { rememberReturn, safeReturn } from '../lib/returnTo'

// Sign-in (U1). Either a plain form post to LWW's process_login.html, whose
// sign-in program (LWWADPLI) checks userid and passphrase with RACF and
// starts the session, or LWW's Entra redirect, which maps the Entra identity
// to a RACF userid. The passphrase goes straight from the form to LWW: the
// app never keeps it.
export default function Login() {
  const [params] = useSearchParams()
  const { user } = useSession()
  const [showPassphrase, setShowPassphrase] = useState(false)
  const failed = params.has('failed')
  const requested = safeReturn(params.get('requestedURL') ?? params.get('returnTo'))

  useEffect(() => {
    rememberReturn(requested)
  }, [requested])

  return (
    <section className="card mx-auto w-full max-w-sm p-6">
      <h1 className="text-[17px] font-medium">Sign in</h1>
      <p className="mt-1 text-[13px] text-fg-2">With your RACF userid and passphrase, or with your Entra account.</p>

      {user && (
        <p className="mt-4 rounded-md bg-info-bg px-3 py-2 text-[13px] text-info-fg">
          You&apos;re signed in as {user.userID}.{' '}
          <a className="underline" href={requested ?? BASE}>Continue</a>
        </p>
      )}
      {failed && (
        <div className="mt-4">
          <ErrorBanner error="Sign-in failed. Check your userid and passphrase. After too many wrong attempts RACF revokes your userid." />
        </div>
      )}

      <form action={`${BASE}/process_login.html`} method="post" className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-[13px]">
          Userid
          <input
            className="input uppercase"
            name="username"
            autoComplete="username"
            autoCapitalize="characters"
            spellCheck="false"
            maxLength={8}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px]">
          Passphrase
          <span className="relative flex">
            <input
              className="input pr-9"
              name="password"
              type={showPassphrase ? 'text' : 'password'}
              autoComplete="current-password"
              maxLength={100}
              required
            />
            <button
              type="button"
              className="absolute right-1 top-1 row-action"
              aria-label={showPassphrase ? 'Hide passphrase' : 'Show passphrase'}
              aria-pressed={showPassphrase}
              onClick={() => setShowPassphrase((v) => !v)}
            >
              <i className={`ti ${showPassphrase ? 'ti-eye-off' : 'ti-eye'}`} aria-hidden="true" />
            </button>
          </span>
        </label>
        <button type="submit" className="btn-primary justify-center">Sign in</button>
      </form>

      <div className="my-4 flex items-center gap-3 text-[12px] text-fg-3">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
      <button type="button" className="btn-secondary w-full justify-center" onClick={() => goTo(ENTRA_SIGN_IN_URL)}>
        <i className="ti ti-brand-windows" aria-hidden="true" />
        Sign in with Entra
      </button>
    </section>
  )
}
