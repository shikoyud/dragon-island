const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // Crockford base32

export function newRefCode(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += ALPHABET[b & 31]
  return out
}
