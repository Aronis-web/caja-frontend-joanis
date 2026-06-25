/**
 * Crypto utilities for offline login (frontend-only).
 *
 * Implementa sobre Web Crypto API (disponible en Electron/web):
 *  - base64url encode/decode
 *  - HKDF-SHA256
 *  - AES-256-GCM decrypt
 *  - JWT HS256 sign/verify
 *
 * Ver POS_OFFLINE.MD secciones 5.1 y 5.3.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

// ============ base64url ============

export function base64UrlToBytes(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/** Copia los bytes a un ArrayBuffer puro (Web Crypto rechaza SharedArrayBuffer-typed). */
function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

// ============ HKDF-SHA256 ============

/**
 * Deriva una clave de `length` bytes a partir de un IKM (deviceToken) usando HKDF-SHA256.
 * salt e info se interpretan como cadenas UTF-8 (el contrato pasa cashRegisterId y "pos-offline-users-v1").
 */
export async function hkdfSha256(
  ikm: string,
  salt: string,
  info: string,
  length: number = 32
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(ikm), 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: enc.encode(salt),
      info: enc.encode(info),
    },
    key,
    length * 8
  );
  return new Uint8Array(bits);
}

// ============ AES-256-GCM ============

/**
 * Descifra ciphertext + authTag (ambos b64url) con la clave derivada.
 * Lanza si el authTag no valida (bundle manipulado o deviceToken incorrecto).
 */
export async function aesGcmDecrypt(
  keyBytes: Uint8Array,
  ivB64Url: string,
  ciphertextB64Url: string,
  authTagB64Url: string
): Promise<Uint8Array> {
  const iv = base64UrlToBytes(ivB64Url);
  const ciphertext = base64UrlToBytes(ciphertextB64Url);
  const authTag = base64UrlToBytes(authTagB64Url);
  const combined = concatBytes(ciphertext, authTag);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(keyBytes),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv), tagLength: 128 },
    cryptoKey,
    toArrayBuffer(combined)
  );
  return new Uint8Array(plaintext);
}

// ============ JWT HS256 ============

interface JwtHeader {
  alg: 'HS256';
  typ: 'JWT';
}

async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return new Uint8Array(sig);
}

export async function signJwtHs256<T extends object>(payload: T, secret: string): Promise<string> {
  const header: JwtHeader = { alg: 'HS256', typ: 'JWT' };
  const h = bytesToBase64Url(enc.encode(JSON.stringify(header)));
  const p = bytesToBase64Url(enc.encode(JSON.stringify(payload)));
  const signingInput = `${h}.${p}`;
  const sig = await hmacSha256(secret, signingInput);
  return `${signingInput}.${bytesToBase64Url(sig)}`;
}

/**
 * Decodifica el payload de un JWT sin verificar la firma.
 * Útil para leer claims de tokens emitidos por el backend que ya fueron validados al guardarse
 * (p. ej. el deviceToken almacenado en SecureStorage). No usar para confiar en tokens externos.
 */
export function decodeJwtPayload<T = unknown>(token: string): T | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(dec.decode(base64UrlToBytes(parts[1]))) as T;
  } catch {
    return null;
  }
}

export async function verifyJwtHs256<T = unknown>(
  token: string,
  secret: string
): Promise<T | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const expected = await hmacSha256(secret, `${h}.${p}`);
  const given = base64UrlToBytes(s);
  if (expected.length !== given.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ given[i];
  if (diff !== 0) return null;
  try {
    return JSON.parse(dec.decode(base64UrlToBytes(p))) as T;
  } catch {
    return null;
  }
}

// ============ helpers ============

export function bytesToUtf8(bytes: Uint8Array): string {
  return dec.decode(bytes);
}

/**
 * SHA-256 sobre un string b64url o sobre bytes. Devuelve el digest en hex lowercase.
 * Útil para verificar el `checksum` declarado por el backend (formato "sha256:<hex>").
 */
export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const bytes = typeof input === 'string' ? enc.encode(input) : input;
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(bytes));
  const view = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < view.length; i++) {
    hex += view[i].toString(16).padStart(2, '0');
  }
  return hex;
}
