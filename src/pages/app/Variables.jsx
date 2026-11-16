import VariableList from './VariableList'

// The application's own variables (O3); environments and versions have
// theirs on their tabs
export default function Variables({ appID, isOwner }) {
  return (
    <section className="card flex flex-col gap-3 p-4">
      <p className="text-[13px] text-fg-2">
        The job templates use variables as <code className="font-mono">{'${NAME}'}</code>. A variable of an environment
        overrides the application&apos;s, and one of a version overrides both. LWD fills in{' '}
        <code className="font-mono">LWDAPP</code>, <code className="font-mono">LWDENV</code>,{' '}
        <code className="font-mono">LWDVER</code> and <code className="font-mono">LWDLOC</code> itself.
      </p>
      <VariableList level={{ appID }} canEdit={isOwner} what="the application" />
    </section>
  )
}
