import { ensureDeviceAlbum } from "../../../db/albums";
import { getD1 } from "../../../db";
import type { AlbumSummary } from "../../../lib/types";

function validDevice(value: unknown) {
  const deviceId = typeof value === "string" ? value.trim() : "";
  return /^[a-zA-Z0-9-]{8,80}$/.test(deviceId) ? deviceId : "";
}

function validName(value: unknown) {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return name.length >= 1 && name.length <= 50 ? name : "";
}

function mapAlbum(row: Record<string, unknown>): AlbumSummary {
  return {
    id: Number(row.id),
    name: String(row.name),
    position: Number(row.position),
    itemCount: Number(row.item_count ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function listAlbums(deviceId: string) {
  await ensureDeviceAlbum(deviceId);
  const result = await getD1().prepare(`SELECT a.*, COUNT(ap.id) AS item_count
    FROM albums a LEFT JOIN album_photos ap ON ap.album_id = a.id
    WHERE a.device_id = ? GROUP BY a.id ORDER BY a.position ASC, a.id ASC`)
    .bind(deviceId).all<Record<string, unknown>>();
  return result.results.map(mapAlbum);
}

export async function GET(request: Request) {
  try {
    const deviceId = validDevice(new URL(request.url).searchParams.get("deviceId"));
    if (!deviceId) return Response.json({ error: "기기 식별값이 필요합니다." }, { status: 400 });
    return Response.json({ albums: await listAlbums(deviceId) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "앨범 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { deviceId?: string; name?: string };
    const deviceId = validDevice(payload.deviceId);
    const name = validName(payload.name);
    if (!deviceId || !name) return Response.json({ error: "앨범 이름은 1~50자로 입력해주세요." }, { status: 400 });
    await ensureDeviceAlbum(deviceId);
    const db = getD1();
    const max = await db.prepare("SELECT COALESCE(MAX(position), -1) AS value FROM albums WHERE device_id = ?")
      .bind(deviceId).first<{ value: number }>();
    const now = new Date().toISOString();
    const result = await db.prepare(
      "INSERT INTO albums (device_id, name, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(deviceId, name, Number(max?.value ?? -1) + 1, now, now).run();
    return Response.json({ albumId: Number(result.meta.last_row_id), albums: await listAlbums(deviceId) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "앨범을 만들지 못했습니다.";
    const duplicate = message.includes("UNIQUE");
    return Response.json({ error: duplicate ? "같은 이름의 앨범이 이미 있습니다." : message }, { status: duplicate ? 409 : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json() as { deviceId?: string; albumId?: number; name?: string };
    const deviceId = validDevice(payload.deviceId);
    const albumId = Number(payload.albumId);
    const name = validName(payload.name);
    if (!deviceId || !Number.isInteger(albumId) || !name) return Response.json({ error: "변경할 앨범 정보가 올바르지 않습니다." }, { status: 400 });
    await ensureDeviceAlbum(deviceId);
    const result = await getD1().prepare("UPDATE albums SET name = ?, updated_at = ? WHERE id = ? AND device_id = ?")
      .bind(name, new Date().toISOString(), albumId, deviceId).run();
    if (!result.meta.changes) return Response.json({ error: "앨범을 찾지 못했습니다." }, { status: 404 });
    return Response.json({ albums: await listAlbums(deviceId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "앨범 이름을 변경하지 못했습니다.";
    const duplicate = message.includes("UNIQUE");
    return Response.json({ error: duplicate ? "같은 이름의 앨범이 이미 있습니다." : message }, { status: duplicate ? 409 : 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const deviceId = validDevice(url.searchParams.get("deviceId"));
    const albumId = Number(url.searchParams.get("albumId"));
    if (!deviceId || !Number.isInteger(albumId)) return Response.json({ error: "삭제할 앨범 정보가 올바르지 않습니다." }, { status: 400 });
    await ensureDeviceAlbum(deviceId);
    const db = getD1();
    const owned = await db.prepare("SELECT id FROM albums WHERE id = ? AND device_id = ?").bind(albumId, deviceId).first();
    if (!owned) return Response.json({ error: "앨범을 찾지 못했습니다." }, { status: 404 });
    await db.batch([
      db.prepare("DELETE FROM album_photos WHERE album_id = ?").bind(albumId),
      db.prepare("DELETE FROM albums WHERE id = ? AND device_id = ?").bind(albumId, deviceId),
    ]);
    await ensureDeviceAlbum(deviceId);
    return Response.json({ albums: await listAlbums(deviceId) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "앨범을 삭제하지 못했습니다." }, { status: 500 });
  }
}
