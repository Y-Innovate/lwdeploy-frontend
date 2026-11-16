import { render } from '@testing-library/react'
import App from '../App'

// Renders the whole app at a path under /lwdeploy, as a page load would
export function openApp(path) {
  window.history.pushState({}, '', `/lwdeploy${path}`)
  return render(<App />)
}
