"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cryptoOffline_1 = require("./cryptoOffline");
const assert = (cond, msg) => {
    if (!cond)
        throw new Error(msg);
};
const assertEqual = (actual, expected, msg) => {
    if (actual !== expected) {
        throw new Error(`${msg} (esperado: ${String(expected)}, recibido: ${String(actual)})`);
    }
};
const bytesEqual = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
async function run() {
    // 1) base64url roundtrip y ausencia de caracteres url-unsafe
    const original = new Uint8Array([0, 1, 2, 127, 128, 200, 254, 255]);
    const encoded = (0, cryptoOffline_1.bytesToBase64Url)(original);
    assert(!encoded.includes('+') && !encoded.includes('/') && !encoded.includes('='), '1) base64url no usa caracteres url-unsafe');
    assert(bytesEqual((0, cryptoOffline_1.base64UrlToBytes)(encoded), original), '1) base64url roundtrip preserva bytes');
    // 2) sha256Hex contra vectores conocidos (NIST)
    assertEqual(await (0, cryptoOffline_1.sha256Hex)(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', '2) sha256("") vector NIST');
    assertEqual(await (0, cryptoOffline_1.sha256Hex)('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', '2) sha256("abc") vector NIST');
    // 3) HKDF-SHA256: determinismo, longitud y sensibilidad a salt/info
    const k1 = await (0, cryptoOffline_1.hkdfSha256)('device-token', 'register-1', 'pos-offline-users-v1', 32);
    const k2 = await (0, cryptoOffline_1.hkdfSha256)('device-token', 'register-1', 'pos-offline-users-v1', 32);
    assertEqual(k1.length, 32, '3) HKDF respeta length=32');
    assert(bytesEqual(k1, k2), '3) HKDF es determinista con mismos inputs');
    const kDiffSalt = await (0, cryptoOffline_1.hkdfSha256)('device-token', 'register-2', 'pos-offline-users-v1', 32);
    assert(!bytesEqual(k1, kDiffSalt), '3) HKDF difiere al cambiar salt');
    const kDiffInfo = await (0, cryptoOffline_1.hkdfSha256)('device-token', 'register-1', 'otro-info', 32);
    assert(!bytesEqual(k1, kDiffInfo), '3) HKDF difiere al cambiar info');
    // 4) AES-256-GCM: roundtrip + rechazo de authTag manipulado
    const key = await (0, cryptoOffline_1.hkdfSha256)('device-token', 'register-1', 'pos-offline-users-v1', 32);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const keyBuffer = key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength);
    const cryptoKey = await crypto.subtle.importKey('raw', keyBuffer, { name: 'AES-GCM' }, false, [
        'encrypt',
    ]);
    const plaintext = new TextEncoder().encode(JSON.stringify({ users: [{ id: 'u1' }] }));
    const ivBuffer = iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength);
    const ptBuffer = plaintext.buffer.slice(plaintext.byteOffset, plaintext.byteOffset + plaintext.byteLength);
    const combined = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivBuffer, tagLength: 128 }, cryptoKey, ptBuffer));
    const ct = combined.slice(0, combined.length - 16);
    const tag = combined.slice(combined.length - 16);
    const decrypted = await (0, cryptoOffline_1.aesGcmDecrypt)(key, (0, cryptoOffline_1.bytesToBase64Url)(iv), (0, cryptoOffline_1.bytesToBase64Url)(ct), (0, cryptoOffline_1.bytesToBase64Url)(tag));
    assertEqual(new TextDecoder().decode(decrypted), JSON.stringify({ users: [{ id: 'u1' }] }), '4) AES-GCM roundtrip preserva el plaintext');
    const badTag = new Uint8Array(tag);
    badTag[0] ^= 0x01;
    let aesThrew = false;
    try {
        await (0, cryptoOffline_1.aesGcmDecrypt)(key, (0, cryptoOffline_1.bytesToBase64Url)(iv), (0, cryptoOffline_1.bytesToBase64Url)(ct), (0, cryptoOffline_1.bytesToBase64Url)(badTag));
    }
    catch {
        aesThrew = true;
    }
    assert(aesThrew, '4) AES-GCM rechaza authTag manipulado');
    // 5) JWT HS256: sign/verify roundtrip
    const payload = { sub: 'user-1', exp: 9999999999, offline: true };
    const jwt = await (0, cryptoOffline_1.signJwtHs256)(payload, 'device-token-secret');
    const parts = jwt.split('.');
    assertEqual(parts.length, 3, '5) JWT tiene 3 segmentos');
    const verified = await (0, cryptoOffline_1.verifyJwtHs256)(jwt, 'device-token-secret');
    assert(verified !== null && verified.sub === 'user-1' && verified.offline === true, '5) verifyJwtHs256 acepta firma válida y devuelve payload');
    // 6) verifyJwtHs256 rechaza secret incorrecto
    assertEqual(await (0, cryptoOffline_1.verifyJwtHs256)(jwt, 'otro-secret'), null, '6) verifyJwtHs256 rechaza secret incorrecto');
    // 7) verifyJwtHs256 rechaza firma manipulada (flip de 1 bit)
    const sigBytes = (0, cryptoOffline_1.base64UrlToBytes)(parts[2]);
    sigBytes[0] ^= 0x01;
    const tampered = `${parts[0]}.${parts[1]}.${(0, cryptoOffline_1.bytesToBase64Url)(sigBytes)}`;
    assertEqual(await (0, cryptoOffline_1.verifyJwtHs256)(tampered, 'device-token-secret'), null, '7) verifyJwtHs256 rechaza firma manipulada');
    // 8) decodeJwtPayload extrae claims sin verificar y maneja tokens inválidos
    const decoded = (0, cryptoOffline_1.decodeJwtPayload)(jwt);
    assert(decoded !== null && decoded.sub === 'user-1', '8) decodeJwtPayload extrae payload');
    assertEqual((0, cryptoOffline_1.decodeJwtPayload)('solo.dos'), null, '8) decodeJwtPayload null si <3 segmentos');
    assertEqual((0, cryptoOffline_1.decodeJwtPayload)('aaa.@@@@@.ccc'), null, '8) decodeJwtPayload null si payload no parsea');
    console.log('✅ cryptoOffline tests: OK (8 suites)');
}
run().catch((e) => {
    console.error(e);
    process.exit(1);
});
