"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { AlbumItem, CommentRecord, PhotoRecord } from "../lib/types";

const initialPhoto: PhotoRecord = {
  id: "loading",
  title: "한 장의 세계를 찾는 중",
  description: "잠시만 기다려주세요. 오늘의 사진을 고르고 있습니다.",
  imageUrl: "https://images.pexels.com/photos/417074/pexels-photo-417074.jpeg?auto=compress&cs=tinysrgb&w=1800",
  originalUrl: null,
  sourceUrl: "https://www.pexels.com/",
  ownerId: "",
  ownerName: "FILMPICK",
  dateTaken: null,
  dateUploaded: null,
  latitude: null,
  longitude: null,
  locationName: null,
  tags: [],
  license: null,
  width: null,
  height: null,
};

function getDeviceId() {
  const key = "filmpick-device-id";
  const saved = window.localStorage.getItem(key);
  if (saved) return saved;
  const created = crypto.randomUUID();
  window.localStorage.setItem(key, created);
  return created;
}

function formatDate(value: string | null) {
  if (!value) return "기록 없음";
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(date);
}

export default function Home() {
  const [view, setView] = useState<"discover" | "album">("discover");
  const [tag, setTag] = useState("");
  const [location, setLocation] = useState("");
  const [conditions, setConditions] = useState({ tag: "", location: "" });
  const [photo, setPhoto] = useState<PhotoRecord>(initialPhoto);
  const [loading, setLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState(true);
  const [error, setError] = useState("");
  const [demo, setDemo] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [album, setAlbum] = useState<AlbumItem[]>([]);
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [commentName, setCommentName] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);

  const isSaved = useMemo(() => album.some((item) => item.id === photo.id), [album, photo.id]);

  const loadAlbum = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/album?deviceId=${encodeURIComponent(id)}`);
      const data = await response.json() as { items?: AlbumItem[]; error?: string };
      if (!response.ok) throw new Error(data.error);
      setAlbum(data.items ?? []);
    } catch {
      setError("앨범을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    }
  }, []);

  const loadComments = useCallback(async (photoId: string) => {
    if (!photoId || photoId === "loading") return;
    try {
      const response = await fetch(`/api/comments?photoId=${encodeURIComponent(photoId)}`);
      const data = await response.json() as { comments?: CommentRecord[] };
      if (response.ok) setComments(data.comments ?? []);
    } catch {
      setComments([]);
    }
  }, []);

  const fetchPhoto = useCallback(async (next: { tag: string; location: string }, exclude = "") => {
    setLoading(true);
    setImageLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ tag: next.tag, location: next.location, nonce: String(Date.now()) });
      if (exclude) params.set("exclude", exclude);
      const response = await fetch(`/api/photos?${params}`);
      const data = await response.json() as { photo?: PhotoRecord; demo?: boolean; error?: string };
      if (!response.ok || !data.photo) throw new Error(data.error || "사진을 찾지 못했습니다.");
      setPhoto(data.photo);
      setDemo(Boolean(data.demo));
      setComments([]);
      await loadComments(data.photo.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "사진을 찾지 못했습니다.");
      setImageLoading(false);
    } finally {
      setLoading(false);
    }
  }, [loadComments]);

  useEffect(() => {
    const id = getDeviceId();
    setDeviceId(id);
    void loadAlbum(id);
    void fetchPhoto({ tag: "", location: "" });
  }, [fetchPhoto, loadAlbum]);

  async function search(event: FormEvent) {
    event.preventDefault();
    const next = { tag: tag.trim(), location: location.trim() };
    setConditions(next);
    setView("discover");
    await fetchPhoto(next);
  }

  async function savePhoto() {
    if (!deviceId || isSaved || photo.id === "loading") return;
    try {
      const response = await fetch("/api/album", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, photo }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error);
      await loadAlbum(deviceId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "앨범에 저장하지 못했습니다.");
    }
  }

  async function deleteItem(id: number) {
    const previous = album;
    setAlbum((items) => items.filter((item) => item.albumId !== id));
    try {
      const response = await fetch(`/api/album?id=${id}&deviceId=${encodeURIComponent(deviceId)}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
    } catch {
      setAlbum(previous);
      setError("앨범에서 사진을 삭제하지 못했습니다.");
    }
  }

  async function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= album.length) return;
    const reordered = [...album];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setAlbum(reordered);
    try {
      const response = await fetch("/api/album", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, orderedIds: reordered.map((item) => item.albumId) }),
      });
      if (!response.ok) throw new Error();
    } catch {
      setAlbum(album);
      setError("앨범 순서를 변경하지 못했습니다.");
    }
  }

  async function submitComment(event: FormEvent) {
    event.preventDefault();
    if (!commentBody.trim() || !deviceId) return;
    setCommentBusy(true);
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: photo.id, deviceId, authorName: commentName, body: commentBody }),
      });
      const data = await response.json() as { comment?: CommentRecord; error?: string };
      if (!response.ok || !data.comment) throw new Error(data.error);
      setComments((items) => [data.comment!, ...items]);
      setCommentBody("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "코멘트를 남기지 못했습니다.");
    } finally {
      setCommentBusy(false);
    }
  }

  function openAlbumPhoto(item: AlbumItem) {
    setPhoto(item);
    setConditions({ tag: "", location: "" });
    setView("discover");
    setImageLoading(true);
    void loadComments(item.id);
    window.scrollTo({ top: document.querySelector(".photo-stage")?.getBoundingClientRect().top ?? 0, behavior: "smooth" });
  }

  return (
    <main className="site-shell" id="top">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setView("discover")} aria-label="필름픽 발견 화면">
          <span className="brand-mark" aria-hidden="true">●</span> FILMPICK
        </button>
        <nav aria-label="주요 메뉴">
          <button className={`nav-link ${view === "discover" ? "active" : ""}`} type="button" onClick={() => setView("discover")}>발견</button>
          <button className={`nav-link ${view === "album" ? "active" : ""}`} type="button" onClick={() => setView("album")}>내 앨범 <span className="count">{album.length}</span></button>
        </nav>
      </header>

      {error && <div className="notice error-notice" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="알림 닫기">×</button></div>}

      {view === "discover" ? (
        <>
          <section className="hero" id="discover">
            <form className="search-card" onSubmit={search}>
              <label><span>태그</span><input name="tag" value={tag} onChange={(event) => setTag(event.target.value)} placeholder="예: 고양이, 건축, 여름" maxLength={120} /></label>
              <label><span>위치</span><input name="location" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="예: 서울, 파리, 제주" maxLength={120} /></label>
              <button type="submit" disabled={loading}>사진 찾기 <span aria-hidden="true">→</span></button>
            </form>
            <div className="condition-row" aria-live="polite">
              {(conditions.tag || conditions.location) ? <><span>현재 조건</span>{conditions.tag && <b>#{conditions.tag}</b>}{conditions.location && <b>⌖ {conditions.location}</b>}</> : <span>조건 없이 오늘의 추천 사진을 만나보세요.</span>}
            </div>
            {demo && <p className="demo-note">Pexels API 키 연결 전 데모 모드입니다. 키를 추가하면 같은 화면에서 실제 Pexels 사진을 검색합니다.</p>}
          </section>

          <section className={`photo-stage ${loading ? "is-loading" : ""}`} aria-label="발견한 사진" aria-busy={loading}>
            <div className="photo-frame">
              <img src={photo.imageUrl} alt={photo.title} onLoad={() => setImageLoading(false)} onError={() => setImageLoading(false)} className={imageLoading ? "image-pending" : ""} />
              {(loading || imageLoading) && <div className="image-loader"><span /></div>}
              <div className="photo-counter">ONE PHOTO · ONE MOMENT</div>
              <div className="photo-actions">
                <button className={isSaved ? "saved" : ""} type="button" onClick={savePhoto} aria-label={isSaved ? "앨범에 저장됨" : "앨범에 저장"} disabled={isSaved}>{isSaved ? "♥" : "♡"}</button>
                <button type="button" onClick={() => fetchPhoto(conditions, photo.id)} disabled={loading}>다른 사진 <span aria-hidden="true">↻</span></button>
              </div>
            </div>
            <aside className="photo-caption">
              <div>
                <p className="photo-kicker">TODAY’S DISCOVERY</p>
                <h2>{photo.title}</h2>
                <p className="description">{photo.description}</p>
                <div className="source-links">
                  <a href={photo.sourceUrl} target="_blank" rel="noreferrer">Pexels 사진 페이지 ↗</a>
                  {photo.originalUrl && <a href={photo.originalUrl} target="_blank" rel="noreferrer">원본 파일 열기 ↗</a>}
                </div>
              </div>
              <dl>
                <div><dt>사진가</dt><dd><a href={photo.ownerId || photo.sourceUrl} target="_blank" rel="noreferrer">{photo.ownerName}</a></dd></div>
                <div><dt>촬영일</dt><dd>{formatDate(photo.dateTaken)}</dd></div>
                <div><dt>검색 위치</dt><dd>{photo.locationName ?? (photo.latitude != null ? `${photo.latitude.toFixed(4)}, ${photo.longitude?.toFixed(4)}` : "지정하지 않음")}{photo.latitude != null && <a className="map-link" href={`https://www.openstreetmap.org/?mlat=${photo.latitude}&mlon=${photo.longitude}#map=12/${photo.latitude}/${photo.longitude}`} target="_blank" rel="noreferrer">지도 ↗</a>}</dd></div>
                {(photo.width || photo.height) && <div><dt>크기</dt><dd>{photo.width ?? "?"} × {photo.height ?? "?"} px</dd></div>}
                <div className="tags-row"><dt>태그</dt><dd>{photo.tags.length ? photo.tags.slice(0, 8).map((item) => <button className="tag" type="button" key={item} onClick={() => { setTag(item); setConditions({ tag: item, location: "" }); void fetchPhoto({ tag: item, location: "" }); }}>{item}</button>) : <span>태그 없음</span>}</dd></div>
              </dl>
            </aside>
          </section>

          <section className="comments-section">
            <div className="section-heading"><div><p className="eyebrow">NOTES ON THIS MOMENT</p><h3>이 장면에 남긴 생각</h3></div><span>{comments.length}개의 코멘트</span></div>
            <div className="comments-layout">
              <form className="comment-form" onSubmit={submitComment}>
                <label><span>이름</span><input value={commentName} onChange={(event) => setCommentName(event.target.value)} placeholder="익명의 감상자" maxLength={40} /></label>
                <label><span>코멘트</span><textarea value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="이 사진에서 무엇이 보이나요?" maxLength={500} rows={4} required /></label>
                <div><small>{commentBody.length}/500</small><button type="submit" disabled={commentBusy || !commentBody.trim()}>코멘트 남기기</button></div>
              </form>
              <div className="comment-list">
                {comments.length ? comments.map((comment) => <article className="comment" key={comment.id}><div><b>{comment.authorName}</b><time>{formatDate(comment.createdAt)}</time></div><p>{comment.body}</p></article>) : <div className="empty-comments">아직 코멘트가 없습니다.<br />첫 감상을 남겨보세요.</div>}
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="album-section" id="album">
          <div className="album-header"><div><p className="eyebrow">MY VISUAL ARCHIVE</p><h1>마음에 남은<br />장면들</h1></div><p>저장한 사진을 다시 열어보거나, 화살표로 순서를 바꾸고 앨범에서 삭제할 수 있습니다.</p></div>
          {album.length ? <div className="album-grid">{album.map((item, index) => (
            <article className="album-card" key={item.albumId}>
              <button className="album-photo" type="button" onClick={() => openAlbumPhoto(item)}><img src={item.imageUrl} alt={item.title} /><span>자세히 보기 ↗</span></button>
              <div className="album-card-copy"><div><small>{String(index + 1).padStart(2, "0")}</small><h2>{item.title}</h2><p>{item.ownerName}</p></div><div className="album-controls"><button type="button" onClick={() => moveItem(index, -1)} disabled={index === 0} aria-label="앞으로 이동">←</button><button type="button" onClick={() => moveItem(index, 1)} disabled={index === album.length - 1} aria-label="뒤로 이동">→</button><button className="delete" type="button" onClick={() => deleteItem(item.albumId)}>삭제</button></div></div>
            </article>
          ))}</div> : <div className="empty-album"><span>○</span><h2>아직 저장한 장면이 없습니다.</h2><p>발견 화면에서 마음에 드는 사진의 하트를 눌러보세요.</p><button type="button" onClick={() => setView("discover")}>사진 발견하러 가기 →</button></div>}
        </section>
      )}

      <footer><div className="brand"><span className="brand-mark">●</span> FILMPICK</div><p>Pexels의 공개 사진을 이용합니다. 사진 저작권은 각 사진가에게 있습니다.</p><a href="https://www.pexels.com" target="_blank" rel="noreferrer">Photos provided by Pexels ↗</a></footer>
    </main>
  );
}
