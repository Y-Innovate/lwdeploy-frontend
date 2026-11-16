import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { usePagedList } from './usePagedList'

function fakeList(pages) {
  return {
    list: vi.fn(async (_filters, since) => {
      const page = pages[since?.page ?? 0]
      if (page instanceof Error) throw page
      return page
    }),
  }
}

it('loads the first page, then appends the next', async () => {
  const resource = fakeList([{ rows: [1, 2], next: { page: 1 } }, { rows: [3], next: null }])
  const { result } = renderHook(() => usePagedList(resource, { appID: 1 }))
  await waitFor(() => expect(result.current.rows).toEqual([1, 2]))
  expect(result.current.next).toEqual({ page: 1 })
  await act(() => result.current.loadMore())
  expect(result.current.rows).toEqual([1, 2, 3])
  expect(result.current.next).toBeNull()
})

it('waits while not enabled', async () => {
  const resource = fakeList([{ rows: [1], next: null }])
  const { result, rerender } = renderHook(({ on }) => usePagedList(resource, {}, { enabled: on }), {
    initialProps: { on: false },
  })
  expect(result.current.loading).toBe(false)
  expect(resource.list).not.toHaveBeenCalled()
  rerender({ on: true })
  await waitFor(() => expect(result.current.rows).toEqual([1]))
})

it('keeps the rows and reports the error', async () => {
  const resource = fakeList([{ rows: [1], next: { page: 1 } }, new Error('boom')])
  const { result } = renderHook(() => usePagedList(resource, {}))
  await waitFor(() => expect(result.current.rows).toEqual([1]))
  await act(() => result.current.loadMore())
  expect(result.current.error?.message).toBe('boom')
  expect(result.current.rows).toEqual([1])
})

it('restarts when the filters change', async () => {
  const resource = fakeList([{ rows: ['a'], next: null }])
  const { rerender } = renderHook(({ f }) => usePagedList(resource, f), { initialProps: { f: { appID: 1 } } })
  await waitFor(() => expect(resource.list).toHaveBeenCalledTimes(1))
  rerender({ f: { appID: 2 } })
  await waitFor(() => expect(resource.list).toHaveBeenCalledTimes(2))
  expect(resource.list.mock.calls[1][0]).toEqual({ appID: 2 })
})
