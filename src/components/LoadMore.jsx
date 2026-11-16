// "More" under a paged list; hidden when there is no next page
export default function LoadMore({ list, label = 'More' }) {
  if (!list.next) return null
  return (
    <div className="flex justify-center">
      <button type="button" className="btn-secondary" disabled={list.loading} onClick={() => list.loadMore()}>
        {list.loading ? 'Loading…' : label}
      </button>
    </div>
  )
}
