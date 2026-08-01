"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.base64UrlToBytes = base64UrlToBytes;
exports.bytesToBase64Url = bytesToBase64Url;
exports.hkdfSha256 = hkdfSha256;
exports.aesGcmDecrypt = aesGcmDecrypt;
exports.signJwtHs256 = signJwtHs256;
exports.decodeJwtPayload = decodeJwtPayload;
exports.verifyJwtHs256 = verifyJwtHs256;
exports.bytesToUtf8 = bytesToUtf8;
exports.sha256Hex = sha256Hex;
const enc = new TextEncoder();
const dec = new TextDecoder();
// ============ base64url ============
function base64UrlToBytes(input) {
    const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++)
        out[i] = bin.charCodeAt(i);
    return out;
}
function bytesToBase64Url(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++)
        bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function concatBytes(a, b) {
    const out = new Uint8Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
}
/** Copia los bytes a un ArrayBuffer puro (Web Crypto rechaza SharedArrayBuffer-typed). */
function toArrayBuffer(view) {
    return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
}
// ============ HKDF-SHA256 ============
/**
 * Deriva una clave de `length` bytes a partir de un IKM (deviceToken) usando HKDF-SHA256.
 * salt e info se interpretan como cadenas UTF-8 (el contrato pasa cashRegisterId y "pos-offline-users-v1").
 */
async function hkdfSha256(ikm, salt, info, length = 32) {
    const key = await crypto.subtle.importKey('raw', enc.encode(ikm), 'HKDF', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({
        name: 'HKDF',
        hash: 'SHA-256',
        salt: enc.encode(salt),
        info: enc.encode(info),
    }, key, length * 8);
    return new Uint8Array(bits);
}
// ============ AES-256-GCM ============
/**
 * Descifra ciphertext + authTag (ambos b64url) con la clave derivada.
 * Lanza si el authTag no valida (bundle manipulado o deviceToken incorrecto).
 */
async function aesGcmDecrypt(keyBytes, ivB64Url, ciphertextB64Url, authTagB64Url) {
    const iv = base64UrlToBytes(ivB64Url);
    const ciphertext = base64UrlToBytes(ciphertextB64Url);
    const authTag = base64UrlToBytes(authTagB64Url);
    const combined = concatBytes(ciphertext, authTag);
    const cryptoKey = await crypto.subtle.importKey('raw', toArrayBuffer(keyBytes), { name: 'AES-GCM' }, false, ['decrypt']);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv), tagLength: 128 }, cryptoKey, toArrayBuffer(combined));
    return new Uint8Array(plaintext);
}
async function hmacSha256(secret, data) {
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
    return new Uint8Array(sig);
}
async function signJwtHs256(payload, secret) {
    const header = { alg: 'HS256', typ: 'JWT' };
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
function decodeJwtPayload(token) {
    const parts = token.split('.');
    if (parts.length !== 3)
        return null;
    try {
        return JSON.parse(dec.decode(base64UrlToBytes(parts[1])));
    }
    catch {
        return null;
    }
}
async function verifyJwtHs256(token, secret) {
    const parts = token.split('.');
    if (parts.length !== 3)
        return null;
    const [h, p, s] = parts;
    const expected = await hmacSha256(secret, `${h}.${p}`);
    const given = base64UrlToBytes(s);
    if (expected.length !== given.length)
        return null;
    let diff = 0;
    for (let i = 0; i < expected.length; i++)
        diff |= expected[i] ^ given[i];
    if (diff !== 0)
        return null;
    try {
        return JSON.parse(dec.decode(base64UrlToBytes(p)));
    }
    catch {
        return null;
    }
}
// ============ helpers ============
function bytesToUtf8(bytes) {
    return dec.decode(bytes);
}
/**
 * SHA-256 sobre un string b64url o sobre bytes. Devuelve el digest en hex lowercase.
 * Útil para verificar el `checksum` declarado por el backend (formato "sha256:<hex>").
 */
async function sha256Hex(input) {
    const bytes = typeof input === 'string' ? enc.encode(input) : input;
    const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(bytes));
    const view = new Uint8Array(digest);
    let hex = '';
    for (let i = 0; i < view.length; i++) {
        hex += view[i].toString(16).padStart(2, '0');
    }
    return hex;
}
