import { HttpError } from "@/lib/errors";
import type { AppEnv } from "@/lib/runtime";
import { ensureRadar, ensureSchema } from "@/lib/store";
import type { Account } from "@/lib/types";

export const SESSION_COOKIE = "olx_radar_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
// The production Web Crypto runtime rejects PBKDF2 counts above 100,000.
const PBKDF2_ITERATIONS = 100_000;
const encoder = new TextEncoder();

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

type UserRow = {
  created_at: string;
  display_name: string;
  failed_login_count: number;
  is_active: number;
  locked_until: string | null;
  must_change_password: number;
  password_hash: string;
  password_salt: string;
  role: "admin" | "user";
  username: string;
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToBase64(new Uint8Array(digest));
}

async function passwordHash(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      hash: "SHA-256",
      iterations: PBKDF2_ITERATIONS,
      name: "PBKDF2",
      salt: asArrayBuffer(salt),
    },
    key,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

function safeEqual(left: string, right: string): boolean {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

export function normalizeUsername(value: unknown): string {
  if (typeof value !== "string") {
    throw new HttpError(400, "Podaj login.");
  }
  const username = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
    throw new HttpError(
      400,
      "Login musi mieć 3–32 znaki: litery, cyfry, kropka, myślnik lub podkreślenie.",
    );
  }
  return username;
}

function validatePassword(password: unknown): string {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 128 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    throw new HttpError(
      400,
      "Hasło musi mieć minimum 12 znaków, małą i wielką literę, cyfrę oraz znak specjalny.",
    );
  }
  return password;
}

function accountFromRow(row: UserRow): Account {
  return {
    createdAt: row.created_at,
    displayName: row.display_name,
    mustChangePassword: Boolean(row.must_change_password),
    role: row.role,
    username: row.username,
  };
}

function isLocalUrl(requestUrl: string): boolean {
  const hostname = new URL(requestUrl).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function useSecureCookie(requestUrl: string): boolean {
  try {
    if (process.env.APP_URL) {
      return new URL(process.env.APP_URL).protocol === "https:";
    }
  } catch {
    // Walidacja brakującego lub błędnego APP_URL odbywa się przy starcie monitora.
  }
  return !isLocalUrl(requestUrl);
}

export async function bootstrapAdmin(
  env: AppEnv,
  requestUrl: string,
): Promise<void> {
  await ensureSchema(env.DB);
  const username = normalizeUsername(
    env.ADMIN_USERNAME ?? (isLocalUrl(requestUrl) ? "admin" : ""),
  );
  const password =
    env.ADMIN_PASSWORD ?? (isLocalUrl(requestUrl) ? "Radar-Local-2026!" : "");
  if (!password) {
    throw new Error("Brakuje hasła administratora w konfiguracji serwera.");
  }
  validatePassword(password);
  const existing = await env.DB
    .prepare("SELECT username FROM users WHERE username = ?")
    .bind(username)
    .first<{ username: string }>();
  if (existing) return;

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await passwordHash(password, salt);
  await env.DB
    .prepare(
      `INSERT INTO users (
         username, display_name, password_hash, password_salt, role,
         must_change_password, is_active
       ) VALUES (?, ?, ?, ?, 'admin', 0, 1)`,
    )
    .bind(
      username,
      env.ADMIN_DISPLAY_NAME?.trim() || "Administrator",
      hash,
      bytesToBase64(salt),
    )
    .run();
  await ensureRadar(env.DB, username);
}

export async function authenticate(
  env: AppEnv,
  requestUrl: string,
  usernameValue: unknown,
  passwordValue: unknown,
): Promise<{ account: Account; token: string }> {
  await bootstrapAdmin(env, requestUrl);
  const username = normalizeUsername(usernameValue);
  const password = typeof passwordValue === "string" ? passwordValue : "";
  const row = await env.DB
    .prepare("SELECT * FROM users WHERE username = ?")
    .bind(username)
    .first<UserRow>();

  const fallbackSalt = new Uint8Array(16);
  const candidate = await passwordHash(
    password || "invalid-password",
    row ? base64ToBytes(row.password_salt) : fallbackSalt,
  );
  const valid = Boolean(row && safeEqual(candidate, row.password_hash));

  if (!row || !row.is_active || !valid) {
    if (row) {
      const attempts = row.failed_login_count + 1;
      const lock = attempts >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : null;
      await env.DB
        .prepare(
          `UPDATE users SET
             failed_login_count = ?,
             locked_until = COALESCE(?, locked_until),
             updated_at = CURRENT_TIMESTAMP
           WHERE username = ?`,
        )
        .bind(attempts >= 5 ? 0 : attempts, lock, username)
        .run();
    }
    throw new HttpError(401, "Nieprawidłowy login lub hasło.");
  }
  if (row.locked_until && Date.parse(row.locked_until) > Date.now()) {
    throw new HttpError(
      429,
      "Konto jest chwilowo zablokowane po kilku nieudanych próbach.",
    );
  }

  const token = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  await env.DB.batch([
    env.DB
      .prepare(
        `INSERT INTO sessions (token_hash, username, expires_at)
         VALUES (?, ?, ?)`,
      )
      .bind(tokenHash, username, expiresAt),
    env.DB
      .prepare(
        `UPDATE users SET
           failed_login_count = 0,
           locked_until = NULL,
           last_login_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
         WHERE username = ?`,
      )
      .bind(username),
    env.DB
      .prepare("DELETE FROM sessions WHERE datetime(expires_at) <= CURRENT_TIMESTAMP"),
  ]);
  return { account: accountFromRow(row), token };
}

function cookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=") || null;
  }
  return null;
}

export async function accountFromCookie(
  env: AppEnv,
  cookieHeader: string | null,
): Promise<Account | null> {
  await ensureSchema(env.DB);
  const token = cookieValue(cookieHeader, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB
    .prepare(
      `SELECT users.*
       FROM sessions
       JOIN users ON users.username = sessions.username
       WHERE sessions.token_hash = ?
         AND datetime(sessions.expires_at) > CURRENT_TIMESTAMP
         AND users.is_active = 1`,
    )
    .bind(tokenHash)
    .first<UserRow>();
  return row ? accountFromRow(row) : null;
}

export function sessionCookie(token: string, requestUrl: string): string {
  const secure = useSecureCookie(requestUrl) ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function clearedSessionCookie(requestUrl: string): string {
  const secure = useSecureCookie(requestUrl) ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export async function deleteSession(
  env: AppEnv,
  cookieHeader: string | null,
): Promise<void> {
  const token = cookieValue(cookieHeader, SESSION_COOKIE);
  if (!token) return;
  await env.DB
    .prepare("DELETE FROM sessions WHERE token_hash = ?")
    .bind(await sha256(token))
    .run();
}

export function generateTemporaryPassword(): string {
  const groups = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghijkmnopqrstuvwxyz",
    "23456789",
    "!@#$%*-_",
  ];
  const all = groups.join("");
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  const characters = groups.map(
    (group, index) => group[bytes[index] % group.length],
  );
  for (let index = characters.length; index < bytes.length; index += 1) {
    characters.push(all[bytes[index] % all.length]);
  }
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swap = bytes[index] % (index + 1);
    [characters[index], characters[swap]] = [
      characters[swap],
      characters[index],
    ];
  }
  return characters.join("");
}

export async function createManagedAccount(
  env: AppEnv,
  usernameValue: unknown,
  displayNameValue: unknown,
): Promise<{ account: Account; temporaryPassword: string }> {
  const username = normalizeUsername(usernameValue);
  const displayName =
    typeof displayNameValue === "string" && displayNameValue.trim()
      ? displayNameValue.trim().slice(0, 80)
      : username;
  const temporaryPassword = generateTemporaryPassword();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await passwordHash(temporaryPassword, salt);
  try {
    await env.DB
      .prepare(
        `INSERT INTO users (
           username, display_name, password_hash, password_salt, role,
           must_change_password, is_active
         ) VALUES (?, ?, ?, ?, 'user', 1, 1)`,
      )
      .bind(username, displayName, hash, bytesToBase64(salt))
      .run();
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      throw new HttpError(409, "Taki login już istnieje.");
    }
    throw error;
  }
  await ensureRadar(env.DB, username);
  return {
    account: {
      createdAt: new Date().toISOString(),
      displayName,
      mustChangePassword: true,
      role: "user",
      username,
    },
    temporaryPassword,
  };
}

export async function listManagedAccounts(env: AppEnv): Promise<Account[]> {
  await ensureSchema(env.DB);
  const result = await env.DB
    .prepare(
      `SELECT * FROM users
       WHERE role = 'user' AND is_active = 1
       ORDER BY created_at DESC
       LIMIT 200`,
    )
    .all<UserRow>();
  return (result.results ?? []).map(accountFromRow);
}

export async function changePassword(
  env: AppEnv,
  username: string,
  currentPasswordValue: unknown,
  newPasswordValue: unknown,
): Promise<void> {
  const currentPassword =
    typeof currentPasswordValue === "string" ? currentPasswordValue : "";
  const newPassword = validatePassword(newPasswordValue);
  const row = await env.DB
    .prepare("SELECT * FROM users WHERE username = ?")
    .bind(username)
    .first<UserRow>();
  if (!row) throw new HttpError(404, "Nie znaleziono konta.");
  const currentHash = await passwordHash(
    currentPassword,
    base64ToBytes(row.password_salt),
  );
  if (!safeEqual(currentHash, row.password_hash)) {
    throw new HttpError(400, "Obecne hasło jest nieprawidłowe.");
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await passwordHash(newPassword, salt);
  await env.DB.batch([
    env.DB
      .prepare(
        `UPDATE users SET
           password_hash = ?,
           password_salt = ?,
           must_change_password = 0,
           updated_at = CURRENT_TIMESTAMP
         WHERE username = ?`,
      )
      .bind(hash, bytesToBase64(salt), username),
    env.DB
      .prepare("DELETE FROM sessions WHERE username = ?")
      .bind(username),
  ]);
}

export async function deactivateManagedAccount(
  env: AppEnv,
  usernameValue: unknown,
): Promise<void> {
  const username = normalizeUsername(usernameValue);
  const row = await env.DB
    .prepare("SELECT role FROM users WHERE username = ?")
    .bind(username)
    .first<{ role: string }>();
  if (!row || row.role !== "user") {
    throw new HttpError(404, "Nie znaleziono konta użytkownika.");
  }
  await env.DB.batch([
    env.DB
      .prepare(
        "UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE username = ?",
      )
      .bind(username),
    env.DB.prepare("DELETE FROM sessions WHERE username = ?").bind(username),
    env.DB
      .prepare("UPDATE radars SET active = 0 WHERE owner_username = ?")
      .bind(username),
  ]);
}
