import { Link } from 'react-router'
import { PATHS } from '../routes'

export default function NotFound() {
  return (
    <section className="card p-6">
      <h1 className="text-[17px] font-medium">Page not found</h1>
      <p className="mt-1 text-fg-2">
        This page doesn&apos;t exist. <Link className="underline" to={PATHS.home}>See your applications</Link>.
      </p>
    </section>
  )
}
