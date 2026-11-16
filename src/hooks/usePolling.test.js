import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { usePolling } from './usePolling'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it('calls the latest function every interval while enabled', () => {
  const first = vi.fn()
  const second = vi.fn()
  const { rerender, unmount } = renderHook(({ fn, on }) => usePolling(fn, 1000, on), {
    initialProps: { fn: first, on: true },
  })
  vi.advanceTimersByTime(1000)
  expect(first).toHaveBeenCalledTimes(1)
  rerender({ fn: second, on: true })
  vi.advanceTimersByTime(1000)
  expect(second).toHaveBeenCalledTimes(1)
  rerender({ fn: second, on: false })
  vi.advanceTimersByTime(5000)
  expect(second).toHaveBeenCalledTimes(1)
  unmount()
})

it('skips a hidden tab, and catches up when it is shown', () => {
  const fn = vi.fn()
  let state = 'hidden'
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => state)
  renderHook(() => usePolling(fn, 1000))
  vi.advanceTimersByTime(3000)
  expect(fn).not.toHaveBeenCalled()
  state = 'visible'
  document.dispatchEvent(new Event('visibilitychange'))
  expect(fn).toHaveBeenCalledTimes(1)
})
