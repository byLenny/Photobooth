import fs from "node:fs";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import { config, paths } from "./config.js";
import { DEFAULT_SETTINGS, type FilterName, type SessionRecord, type Settings } from "./types.js";

fs.mkdirSync(config.dataDir, { recursive: true });
fs.mkdirSync(paths.photosDir, { recursive: true });
fs.mkdirSync(paths.overlaysDir, { recursive: true });

export const db = new Database(paths.dbFile);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    filter TEXT NOT NULL,
    original_files TEXT NOT NULL,
    branded_file TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_sessions (
    token TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL
  );
`);

function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(pin, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
}

// --- settings ---

const getSettingStmt = db.prepare("SELECT value FROM settings WHERE key = ?");
const setSettingStmt = db.prepare(
  "INSERT INTO settings (key, value) VALUES (@key, @value) ON CONFLICT(key) DO UPDATE SET value = @value",
);

function getRaw<T>(key: string, fallback: T): T {
  const row = getSettingStmt.get(key) as { value: string } | undefined;
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

function setRaw(key: string, value: unknown): void {
  setSettingStmt.run({ key, value: JSON.stringify(value) });
}

// seed defaults + admin pin on first boot
for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
  if (!getSettingStmt.get(key)) {
    setRaw(key, value);
  }
}
if (!getSettingStmt.get("adminPinHash")) {
  setRaw("adminPinHash", hashPin(config.adminPinSeed));
}

export function getSettings(): Settings {
  const settings = {} as Settings;
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    (settings[key] as unknown) = getRaw(key, DEFAULT_SETTINGS[key]);
  }
  return settings;
}

export function updateSettings(partial: Partial<Settings>): Settings {
  for (const [key, value] of Object.entries(partial)) {
    setRaw(key, value);
  }
  return getSettings();
}

export function getAdminPinHash(): string {
  return getRaw<string>("adminPinHash", "");
}

export function setAdminPin(pin: string): void {
  setRaw("adminPinHash", hashPin(pin));
}

// --- admin auth sessions ---

const insertAdminSessionStmt = db.prepare(
  "INSERT INTO admin_sessions (token, expires_at) VALUES (?, ?)",
);
const getAdminSessionStmt = db.prepare(
  "SELECT expires_at as expiresAt FROM admin_sessions WHERE token = ?",
);
const deleteAdminSessionStmt = db.prepare("DELETE FROM admin_sessions WHERE token = ?");
const purgeExpiredAdminSessionsStmt = db.prepare("DELETE FROM admin_sessions WHERE expires_at < ?");

const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export function createAdminSession(): string {
  const token = crypto.randomBytes(32).toString("hex");
  insertAdminSessionStmt.run(token, Date.now() + ADMIN_SESSION_TTL_MS);
  return token;
}

export function isValidAdminSession(token: string): boolean {
  purgeExpiredAdminSessionsStmt.run(Date.now());
  const row = getAdminSessionStmt.get(token) as { expiresAt: number } | undefined;
  return !!row && row.expiresAt > Date.now();
}

export function destroyAdminSession(token: string): void {
  deleteAdminSessionStmt.run(token);
}

// --- sessions (photo sessions) ---

const insertSessionStmt = db.prepare(`
  INSERT INTO sessions (id, created_at, filter, original_files, branded_file)
  VALUES (@id, @createdAt, @filter, @originalFiles, @brandedFile)
`);

export function insertSession(record: SessionRecord): void {
  insertSessionStmt.run({
    id: record.id,
    createdAt: record.createdAt,
    filter: record.filter,
    originalFiles: JSON.stringify(record.originalFiles),
    brandedFile: record.brandedFile,
  });
}

interface SessionRow {
  id: string;
  created_at: number;
  filter: string;
  original_files: string;
  branded_file: string;
}

function rowToRecord(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    filter: row.filter as FilterName,
    originalFiles: JSON.parse(row.original_files) as string[],
    brandedFile: row.branded_file,
  };
}

const listSessionsStmt = db.prepare(
  "SELECT * FROM sessions ORDER BY created_at DESC LIMIT ? OFFSET ?",
);
const listRandomSessionsStmt = db.prepare("SELECT * FROM sessions ORDER BY RANDOM() LIMIT ?");
const countSessionsStmt = db.prepare("SELECT COUNT(*) as count FROM sessions");
const getSessionStmt = db.prepare("SELECT * FROM sessions WHERE id = ?");

export function listSessions(limit: number, offset = 0): SessionRecord[] {
  return (listSessionsStmt.all(limit, offset) as SessionRow[]).map(rowToRecord);
}

export function listRandomSessions(limit: number): SessionRecord[] {
  return (listRandomSessionsStmt.all(limit) as SessionRow[]).map(rowToRecord);
}

export function countSessions(): number {
  return (countSessionsStmt.get() as { count: number }).count;
}

export function getSession(id: string): SessionRecord | undefined {
  const row = getSessionStmt.get(id) as SessionRow | undefined;
  return row ? rowToRecord(row) : undefined;
}
