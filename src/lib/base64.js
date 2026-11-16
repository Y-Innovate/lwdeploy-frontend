// JCL and job output travel as base64 of UTF-8 text with LF line ends
// (lwdeploy/docs/04-api.md, "JCL and job output: base64")
export function decodeBase64Utf8(value) {
  const clean = String(value ?? '').replace(/\s+/g, '')
  if (!clean) return ''
  const bytes = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}

// The other way, for saving template JCL
export function encodeBase64Utf8(text) {
  const bytes = new TextEncoder().encode(String(text ?? ''))
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}
