import { env } from "cloudflare:workers";

export function getD1(): D1Database {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("데이터베이스 연결을 사용할 수 없습니다.");
  return db;
}

let initialized = false;

export async function ensureSchema() {
  if (initialized) return;
  const db = getD1();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS album_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      photo_id TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL,
      original_url TEXT,
      flickr_url TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      date_taken TEXT,
      date_uploaded TEXT,
      latitude REAL,
      longitude REAL,
      location_name TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      license TEXT,
      width INTEGER,
      height INTEGER,
      saved_at TEXT NOT NULL
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_album_device_photo ON album_items(device_id, photo_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_album_device_position ON album_items(device_id, position)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS albums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_albums_device_name ON albums(device_id, name)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_albums_device_position ON albums(device_id, position)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS album_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES album_items(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0,
      saved_at TEXT NOT NULL
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_album_photos_album_item ON album_photos(album_id, item_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_album_photos_album_position ON album_photos(album_id, position)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS album_migrations (
      device_id TEXT PRIMARY KEY,
      migrated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      photo_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_comments_photo_created ON comments(photo_id, created_at)"),
  ]);
  initialized = true;
}
