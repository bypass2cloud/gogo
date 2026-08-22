import { ensureSchema, getD1 } from ".";

export type AlbumRow = {
  id: number;
  device_id: string;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
};

export async function ensureDeviceAlbum(deviceId: string) {
  await ensureSchema();
  const db = getD1();
  let album = await db.prepare(
    "SELECT * FROM albums WHERE device_id = ? ORDER BY position ASC, id ASC LIMIT 1"
  ).bind(deviceId).first<AlbumRow>();

  if (!album) {
    const now = new Date().toISOString();
    await db.prepare(
      "INSERT OR IGNORE INTO albums (device_id, name, position, created_at, updated_at) VALUES (?, '나의 앨범', 0, ?, ?)"
    ).bind(deviceId, now, now).run();
    album = await db.prepare(
      "SELECT * FROM albums WHERE device_id = ? ORDER BY position ASC, id ASC LIMIT 1"
    ).bind(deviceId).first<AlbumRow>();
  }

  if (!album) throw new Error("기본 앨범을 만들지 못했습니다.");

  const migrated = await db.prepare("SELECT device_id FROM album_migrations WHERE device_id = ?")
    .bind(deviceId).first();
  if (!migrated) {
    const migratedAt = new Date().toISOString();
    await db.batch([
      db.prepare(`INSERT OR IGNORE INTO album_photos (album_id, item_id, position, saved_at)
        SELECT ?, id, position, saved_at FROM album_items WHERE device_id = ? ORDER BY position ASC, id ASC`)
        .bind(album.id, deviceId),
      db.prepare("INSERT OR IGNORE INTO album_migrations (device_id, migrated_at) VALUES (?, ?)")
        .bind(deviceId, migratedAt),
    ]);
  }

  return album;
}
