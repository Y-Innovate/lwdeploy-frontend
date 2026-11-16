// What the backend refuses or warns about, counted while typing, so the
// owner sees it before saving (the backend checks again)
export function jclStats(text) {
  const lines = text.replace(/\n$/, '').split('\n')
  return {
    lines: lines.length,
    over80: lines.filter((l) => l.length > 80).length,
    past71: lines.filter((l) => /^\/\/[^*]/.test(l) && l.length > 71 && l.length <= 80).length,
  }
}
