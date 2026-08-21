import { ensureSchema, getD1 } from "../../../db";
import type { CommentRecord } from "../../../lib/types";

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const photoId = (new URL(request.url).searchParams.get("photoId") ?? "").trim().slice(0, 120);
    if (!photoId) return Response.json({ comments: [] });
    const result = await getD1().prepare("SELECT id, photo_id, author_name, body, created_at FROM comments WHERE photo_id = ? ORDER BY created_at DESC, id DESC LIMIT 50")
      .bind(photoId).all<Record<string, unknown>>();
    const comments: CommentRecord[] = result.results.map((row) => ({
      id: Number(row.id),
      photoId: String(row.photo_id),
      authorName: String(row.author_name),
      body: String(row.body),
      createdAt: String(row.created_at),
    }));
    return Response.json({ comments });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "코멘트를 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const payload = await request.json() as { photoId?: string; deviceId?: string; authorName?: string; body?: string };
    const photoId = (payload.photoId ?? "").trim().slice(0, 120);
    const deviceId = (payload.deviceId ?? "").trim().slice(0, 80);
    const authorName = (payload.authorName ?? "익명의 감상자").trim().slice(0, 40) || "익명의 감상자";
    const body = (payload.body ?? "").trim().slice(0, 500);
    if (!photoId || !deviceId || !body) return Response.json({ error: "코멘트 내용을 입력해주세요." }, { status: 400 });
    const createdAt = new Date().toISOString();
    const result = await getD1().prepare("INSERT INTO comments (photo_id, device_id, author_name, body, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(photoId, deviceId, authorName, body, createdAt).run();
    return Response.json({ comment: { id: Number(result.meta.last_row_id), photoId, authorName, body, createdAt } }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "코멘트를 남기지 못했습니다." }, { status: 500 });
  }
}
