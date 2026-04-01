/** Decode Base64 to UTF-8 string (safe for multibyte characters) */
export function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

/** Encode UTF-8 string to Base64 */
export function encodeUtf8Base64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** Decode Base64 to binary string (terminal data, ASCII only) */
export function decodeBase64Binary(base64: string): string {
  return atob(base64);
}

/** Encode binary string to Base64 (terminal data, ASCII only) */
export function encodeBase64Binary(data: string): string {
  return btoa(data);
}
