import type { AppEnv } from "@/lib/runtime";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const LOCAL_KEY_BYTES = encoder.encode("local-olx-radar-dev-key-32-bytes");

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function importKey(env: AppEnv, requestUrl: string): Promise<CryptoKey> {
  const hostname = new URL(requestUrl).hostname;
  const local = hostname === "localhost" || hostname === "127.0.0.1";
  const raw = env.APP_ENCRYPTION_KEY
    ? base64ToBytes(env.APP_ENCRYPTION_KEY)
    : local
      ? LOCAL_KEY_BYTES
      : null;

  if (!raw || raw.byteLength !== 32) {
    throw new Error("Brakuje poprawnego klucza szyfrowania webhooków.");
  }
  return crypto.subtle.importKey("raw", asArrayBuffer(raw), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptSecret(
  env: AppEnv,
  requestUrl: string,
  value: string,
): Promise<{ ciphertext: string; iv: string }> {
  const key = await importKey(env, requestUrl);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: asArrayBuffer(iv) },
    key,
    encoder.encode(value),
  );
  return {
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
  };
}

export async function decryptSecret(
  env: AppEnv,
  requestUrl: string,
  ciphertext: string,
  iv: string,
): Promise<string> {
  const key = await importKey(env, requestUrl);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: asArrayBuffer(base64ToBytes(iv)) },
    key,
    asArrayBuffer(base64ToBytes(ciphertext)),
  );
  return decoder.decode(decrypted);
}
