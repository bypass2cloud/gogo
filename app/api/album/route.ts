import { ensureSchema, getD1 } from "../../../db";
import type { AlbumItem, PhotoRecord } from "../../../lib/types";

function validDevice(value: unknown) {
  const deviceId = typeof value === "string" ? value.trim() : "";
  return /^[a-zA-Z0-9-]{8,80}$/.test(deviceId) ? deviceId : "";
}

function mapRow(row: Record<string, unknown>): AlbumItem {
  return {
    albumId: Number(row.id),
    position: Number(row.position),
    savedAt: String(row.saved_at),
    id: String(row.photo_id),
    title: String(row.title),
    description: String(row.description ?? ""),
    imageUrl: String(row.image_url),
    originalUrl: row.original_url ? String(row.original_url) : null,
    sourceUrl: String(row.flickr_url),
    ownerId: String(row.owner_id),
    ownerName: String(row.owner_name),
    dateTaken: row.date_taken ? String(row.date_taken) : null,
    dateUploaded: row.date_uploaded ? String(row.date_uploaded) : null,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    locationName: row.location_name ? String(row.location_name) : null,
    tags: JSON.parse(String(row.tags ?? "[]")) as string[],
    license: row.license == null ? null : String(row.license),
    width: row.width == null ? null : Number(row.width),
    height: row.height == null ? null : Number(row.height),
  };
}

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const deviceId = validDevice(new URL(request.url).searchParams.get("deviceId"));
    if (!deviceId) return Response.json({ error: "기기 식별값이 필요합니다." }, { status: 400 });
    const result = await getD1().prepare("SELECT * FROM album_items WHERE device_id = ? ORDER BY position ASC, id ASC")
      .bind(deviceId).all<Record<string, unknown>>();
    return Response.json({ items: result.results.map(mapRow) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "앨범을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const payload = await request.json() as { deviceId?: string; photo?: PhotoRecord };
    const deviceId = validDevice(payload.deviceId);
    const photo = payload.photo;
    if (!deviceId || !photo?.id || !photo.imageUrl) return Response.json({ error: "저장할 사진 정보가 올바르지 않습니다." }, { status: 400 });
    const db = getD1();
    const existing = await db.prepare("SELECT id FROM album_items WHERE device_id = ? AND photo_id = ?").bind(deviceId, photo.id).first();
    if (existing) return Response.json({ saved: true, duplicate: true });
    const max = await db.prepare("SELECT COALESCE(MAX(position), -1) AS value FROM album_items WHERE device_id = ?").bind(deviceId).first<{ value: number }>();
    const savedAt = new Date().toISOString();
    await db.prepare(`INSERT INTO album_items (
      device_id, photo_id, position, title, description, image_url, original_url, flickr_url,
      owner_id, owner_name, date_taken, date_uploaded, latitude, longitude, location_name,
      tags, license, width, height, saved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        deviceId, photo.id, Number(max?.value ?? -1) + 1, photo.title.slice(0, 300), photo.description.slice(0, 1000),
        photo.imageUrl, photo.originalUrl, photo.sourceUrl, photo.ownerId, photo.ownerName.slice(0, 200),
        photo.dateTaken, photo.dateUploaded, photo.latitude, photo.longitude, photo.locationName,
        JSON.stringify(photo.tags.slice(0, 30)), photo.license, photo.width, photo.height, savedAt,
      ).run();
    return Response.json({ saved: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "앨범에 저장하지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureSchema();
    const payload = await request.json() as { deviceId?: string; orderedIds?: number[] };
    const deviceId = validDevice(payload.deviceId);
    const orderedIds = (payload.orderedIds ?? []).filter((id) => Number.isInteger(id) && id > 0).slice(0, 200);
    if (!deviceId) return Response.json({ error: "기기 식별값이 필요합니다." }, { status: 400 });
    const db = getD1();
    if (orderedIds.length) {
      await db.batch(orderedIds.map((id, position) =>
        db.prepare("UPDATE album_items SET position = ? WHERE id = ? AND device_id = ?").bind(position, id, deviceId)
      ));
    }
    return Response.json({ reordered: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "앨범 순서를 바꾸지 못했습니다." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureSchema();
    const url = new URL(request.url);
    const deviceId = validDevice(url.searchParams.get("deviceId"));
    const id = Number(url.searchParams.get("id"));
    if (!deviceId || !Number.isInteger(id)) return Response.json({ error: "삭제할 항목이 올바르지 않습니다." }, { status: 400 });
    await getD1().prepare("DELETE FROM album_items WHERE id = ? AND device_id = ?").bind(id, deviceId).run();
    return Response.json({ deleted: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "사진을 삭제하지 못했습니다." }, { status: 500 });
  }
}
