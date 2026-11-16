import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useLoad } from './useLoad'

it('loads, and loads again when the key changes', async () => {
  const load = vi.fn(async () => 'data')
  const { result, rerender } = renderHook(({ k }) => useLoad(load, k), { initialProps: { k: 1 } })
  await waitFor(() => expect(result.current).toMatchObject({ data: 'data', loading: false }))
  rerender({ k: 2 })
  await waitFor(() => expect(load).toHaveBeenCalledTimes(2))
})

it('keeps the data on screen while reloading, and reports an error', async () => {
  let fail = false
  const load = vi.fn(async () => {
    if (fail) throw new Error('down')
    return 'data'
  })
  const { result } = renderHook(() => useLoad(load, 'k'))
  await waitFor(() => expect(result.current.data).toBe('data'))
  fail = true
  await act(() => result.current.reload())
  expect(result.current).toMatchObject({ data: 'data', loading: false })
  expect(result.current.error.message).toBe('down')
})

it('waits while not enabled', () => {
  const load = vi.fn(async () => 'data')
  const { result } = renderHook(() => useLoad(load, 'k', { enabled: false }))
  expect(result.current.loading).toBe(false)
  expect(load).not.toHaveBeenCalled()
})

it('ignores an answer that came after a newer request', async () => {
  const resolvers = []
  const load = vi.fn(() => new Promise((resolve) => resolvers.push(resolve)))
  const { result, rerender } = renderHook(({ k }) => useLoad(load, k), { initialProps: { k: 1 } })
  rerender({ k: 2 })
  await waitFor(() => expect(resolvers).toHaveLength(2))
  await act(async () => resolvers[1]('new'))
  await act(async () => resolvers[0]('old'))
  expect(result.current.data).toBe('new')
})
