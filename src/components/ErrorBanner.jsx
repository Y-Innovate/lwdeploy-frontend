// An error from the API (ApiError) or a plain text, with an optional retry
export default function ErrorBanner({ error, onRetry }) {
  if (!error) return null
  const message = typeof error === 'string' ? error : error.message
  return (
    <div role="alert" className="flex items-center gap-3 rounded-md bg-danger-bg px-4 py-2.5 text-[13px] text-danger-fg">
      <i className="ti ti-alert-triangle text-base" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button type="button" className="underline" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
