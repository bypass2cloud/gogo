import { ensureDeviceAlbum } from "../../../db/albums";
import { getD1 } from "../../../db";
import type { AlbumItem, PhotoRecord } from "../../../lib/types";

function validDevice(value: unknown) {
  const deviceId = typeof value === "string" ? value.trim() : "";
  return /^[a-zA-Z0-9-]{8,80}$/.test(deviceId) ? deviceId : "";
}

function mapRow(row: Record<string, unknown>): AlbumItem {
  return {
    membershipId: Number(row.membership_id),
    albumId: Number(row.parent_album_id),
    position: Number(row.membership_position),
    savedAt: String(row.membership_saved_at),
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

async function ownedAlbum(deviceId: string, albumId: number) {
  return getD1().prepare("SELECT id FROM albums WHERE id = ? AND device_id = ?").bind(albumId, deviceId).first<{ id: number }>();
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const deviceId = validDevice(url.searchParams.get("deviceId"));
    if (!deviceId) return Response.json({ error: "기기 식별값이 필요합니다." }, { status: 400 });
    const fallback = await ensureDeviceAlbum(deviceId);
    const requestedId = Number(url.searchParams.get("albumId"));
    const albumId = Number.isInteger(requestedId) && await ownedAlbum(deviceId, requestedId) ? requestedId : fallback.id;
    const result = await getD1().prepare(`SELECT
      ap.id AS membership_id, ap.album_id AS parent_album_id, ap.position AS membership_position,
      ap.saved_at AS membership_saved_at, ai.*
      FROM album_photos ap INNER JOIN album_items ai ON ai.id = ap.item_id
      INNER JOIN albums a ON a.id = ap.album_id
      WHERE ap.album_id = ? AND a.device_id = ?
      ORDER BY ap.position ASC, ap.id ASC`)
      .bind(albumId, deviceId).all<Record<string, unknown>>();
    return Response.json({ albumId, items: result.results.map(mapRow) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "앨범을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { deviceId?: string; albumId?: number; photo?: PhotoRecord };
    const deviceId = validDevice(payload.deviceId);
    const albumId = Number(payload.albumId);
    const photo = payload.photo;
    if (!deviceId || !Number.isInteger(albumId) || !photo?.id || !photo.imageUrl) {
      return Response.json({ error: "저장할 사진과 앨범 정보가 올바르지 않습니다." }, { status: 400 });
    }
    await ensureDeviceAlbum(deviceId);
    if (!await ownedAlbum(deviceId, albumId)) return Response.json({ error: "저장할 앨범을 찾지 못했습니다." }, { status: 404 });

    const db = getD1();
    let item = await db.prepare("SELECT id FROM album_items WHERE device_id = ? AND photo_id = ?")
      .bind(deviceId, photo.id).first<{ id: number }>();
    if (!item) {
      const result = await db.prepare(`INSERT INTO album_items (
        device_id, photo_id, position, title, description, image_url, original_url, flickr_url,
        owner_id, owner_name, date_taken, date_uploaded, latitude, longitude, location_name,
        tags, license, width, height, saved_at
      ) VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          deviceId, photo.id, photo.title.slice(0, 300), photo.description.slice(0, 1000),
          photo.imageUrl, photo.originalUrl, photo.sourceUrl, photo.ownerId, photo.ownerName.slice(0, 200),
          photo.dateTaken, photo.dateUploaded, photo.latitude, photo.longitude, photo.locationName,
          JSON.stringify(photo.tags.slice(0, 30)), photo.license, photo.width, photo.height, new Date().toISOString(),
        ).run();
      item = { id: Number(result.meta.last_row_id) };
    }

    const existing = await db.prepare("SELECT id FROM album_photos WHERE album_id = ? AND item_id = ?")
      .bind(albumId, item.id).first();
    if (existing) return Response.json({ saved: true, duplicate: true });
    const max = await db.prepare("SELECT COALESCE(MAX(position), -1) AS value FROM album_photos WHERE album_id = ?")
      .bind(albumId).first<{ value: number }>();
    await db.prepare("INSERT INTO album_photos (album_id, item_id, position, saved_at) VALUES (?, ?, ?, ?)")
      .bind(albumId, item.id, Number(max?.value ?? -1) + 1, new Date().toISOString()).run();
    return Response.json({ saved: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "앨범에 저장하지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json() as { deviceId?: string; albumId?: number; orderedIds?: number[] };
    const deviceId = validDevice(payload.deviceId);
    const albumId = Number(payload.albumId);
    const orderedIds = (payload.orderedIds ?? []).filter((id) => Number.isInteger(id) && id > 0).slice(0, 200);
    if (!deviceId || !Number.isInteger(albumId)) return Response.json({ error: "앨범 정보가 올바르지 않습니다." }, { status: 400 });
    await ensureDeviceAlbum(deviceId);
    if (!await ownedAlbum(deviceId, albumId)) return Response.json({ error: "앨범을 찾지 못했습니다." }, { status: 404 });
    const db = getD1();
    if (orderedIds.length) {
      await db.batch(orderedIds.map((id, position) =>
        db.prepare("UPDATE album_photos SET position = ? WHERE id = ? AND album_id = ?").bind(position, id, albumId)
      ));
    }
    return Response.json({ reordered: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "앨범 순서를 바꾸지 못했습니다." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const deviceId = validDevice(url.searchParams.get("deviceId"));
    const membershipId = Number(url.searchParams.get("id"));
    if (!deviceId || !Number.isInteger(membershipId)) return Response.json({ error: "삭제할 항목이 올바르지 않습니다." }, { status: 400 });
    await ensureDeviceAlbum(deviceId);
    const result = await getD1().prepare(`DELETE FROM album_photos WHERE id = ? AND album_id IN (
      SELECT id FROM albums WHERE device_id = ?
    )`).bind(membershipId, deviceId).run();
    if (!result.meta.changes) return Response.json({ error: "삭제할 사진을 찾지 못했습니다." }, { status: 404 });
    return Response.json({ deleted: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "사진을 삭제하지 못했습니다." }, { status: 500 });
  }
}
