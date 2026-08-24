"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AlbumItem, AlbumSummary, CommentRecord, PhotoRecord } from "../lib/types";

type SearchConditions = { tag: string; location: string; source: "pexels" | "openverse" | "all" };

const conditionsStorageKey = "filmpick-search-conditions";
const recentSearchesStorageKey = "filmpick-recent-searches";
const excludedTermsStorageKey = "filmpick-excluded-terms";
const defaultExcludedTerms = ["교회", "성당", "예배", "미사", "church", "cathedral", "worship", "prayer", "시위", "데모", "protest", "demonstration"];

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

function getSavedConditions(): SearchConditions {
  try {
    const saved = JSON.parse(window.localStorage.getItem(conditionsStorageKey) ?? "null") as Partial<SearchConditions> | null;
    return {
      tag: typeof saved?.tag === "string" ? saved.tag.trim().slice(0, 120) : "",
      location: typeof saved?.location === "string" ? saved.location.trim().slice(0, 120) : "",
      source: saved?.source === "pexels" || saved?.source === "openverse" ? saved.source : "all",
    };
  } catch {
    return { tag: "", location: "", source: "all" };
  }
}

function getSavedRecentSearches(): SearchConditions[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(recentSearchesStorageKey) ?? "[]") as unknown;
    if (!Array.isArray(saved)) return [];
    const valid = saved.filter((item): item is SearchConditions => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Partial<SearchConditions>;
      return typeof candidate.tag === "string" && typeof candidate.location === "string" && (candidate.source === "pexels" || candidate.source === "openverse" || candidate.source === "all") && Boolean(candidate.tag.trim() || candidate.location.trim());
    });
    return valid.filter((item, index) => valid.findIndex((candidate) => recentSearchKey(candidate) === recentSearchKey(item)) === index).slice(0, 10);
  } catch {
    return [];
  }
}

function recentSearchKey(search: SearchConditions) {
  return normalizeSearchTerm([search.tag, search.location].filter(Boolean).join(" "));
}

function getSavedExcludedTerms() {
  try {
    const raw = window.localStorage.getItem(excludedTermsStorageKey);
    if (raw === null) return defaultExcludedTerms;
    const saved = JSON.parse(raw) as unknown;
    if (!Array.isArray(saved)) return defaultExcludedTerms;
    return [...new Set(saved.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, 40);
  } catch {
    return defaultExcludedTerms;
  }
}

function searchLabel(search: SearchConditions) {
  return [search.tag, search.location].filter(Boolean).join(" · ");
}

function normalizeSearchTerm(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function formatDate(value: string | null) {
  if (!value) return "기록 없음";
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(date);
}

function cleanPhotoTitle(value: string | null | undefined) {
  const cleaned = (value ?? "")
    .replace(/#[\p{L}\p{N}_-]+/gu, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s|,;·•]+|[\s|,;·•]+$/g, "")
    .trim();
  return cleaned || "제목 없는 사진";
}

export default function Home() {
  const [view, setView] = useState<"discover" | "album">("discover");
  const [tag, setTag] = useState("");
  const [location, setLocation] = useState("");
  const [source, setSource] = useState<SearchConditions["source"]>("all");
  const [conditions, setConditions] = useState<SearchConditions>({ tag: "", location: "", source: "all" });
  const [recentSearches, setRecentSearches] = useState<SearchConditions[]>([]);
  const [excludedTerms, setExcludedTerms] = useState<string[]>(defaultExcludedTerms);
  const [excludedInput, setExcludedInput] = useState("");
  const [photo, setPhoto] = useState<PhotoRecord>(initialPhoto);
  const [loading, setLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState(true);
  const [error, setError] = useState("");
  const [demo, setDemo] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [albums, setAlbums] = useState<AlbumSummary[]>([]);
  const [activeAlbumId, setActiveAlbumId] = useState(0);
  const [album, setAlbum] = useState<AlbumItem[]>([]);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [renameAlbumId, setRenameAlbumId] = useState(0);
  const [renameAlbumName, setRenameAlbumName] = useState("");
  const [deleteConfirmAlbumId, setDeleteConfirmAlbumId] = useState(0);
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [commentName, setCommentName] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const recentPhotoIds = useRef<string[]>([]);
  const excludedTermsRef = useRef<string[]>(defaultExcludedTerms);

  const isSaved = useMemo(() => album.some((item) => item.id === photo.id), [album, photo.id]);
  const activeAlbum = useMemo(() => albums.find((item) => item.id === activeAlbumId) ?? null, [albums, activeAlbumId]);
  const totalSaved = useMemo(() => albums.reduce((sum, item) => sum + item.itemCount, 0), [albums]);
  const recentSearchTerms = useMemo(() => new Set(recentSearches.flatMap((item) => [item.tag, item.location].flatMap((value) => [value, ...value.split(/[\s,]+/)]).map(normalizeSearchTerm).filter(Boolean))), [recentSearches]);
  const visibleTags = useMemo(() => photo.tags.filter((item) => !recentSearchTerms.has(normalizeSearchTerm(item))).slice(0, 8), [photo.tags, recentSearchTerms]);

  const loadAlbumItems = useCallback(async (id: string, albumId: number) => {
    try {
      const response = await fetch(`/api/album?deviceId=${encodeURIComponent(id)}&albumId=${albumId}`);
      const data = await response.json() as { items?: AlbumItem[]; error?: string };
      if (!response.ok) throw new Error(data.error);
      setAlbum(data.items ?? []);
    } catch {
      setError("앨범을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    }
  }, []);

  const loadAlbums = useCallback(async (id: string, preferredAlbumId = 0) => {
    try {
      const response = await fetch(`/api/albums?deviceId=${encodeURIComponent(id)}`);
      const data = await response.json() as { albums?: AlbumSummary[]; error?: string };
      if (!response.ok) throw new Error(data.error);
      const nextAlbums = data.albums ?? [];
      setAlbums(nextAlbums);
      const targetId = nextAlbums.some((item) => item.id === preferredAlbumId) ? preferredAlbumId : (nextAlbums[0]?.id ?? 0);
      setActiveAlbumId(targetId);
      if (targetId) await loadAlbumItems(id, targetId);
      else setAlbum([]);
      return targetId;
    } catch {
      setError("앨범을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      return 0;
    }
  }, [loadAlbumItems]);

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

  const fetchPhoto = useCallback(async (next: SearchConditions, exclude = "", blockedTerms = excludedTermsRef.current) => {
    setLoading(true);
    setImageLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ tag: next.tag, location: next.location, source: next.source, nonce: String(Date.now()) });
      if (blockedTerms.length) params.set("excludeTerms", blockedTerms.join(","));
      const excluded = [...recentPhotoIds.current, exclude].filter(Boolean);
      if (excluded.length) params.set("exclude", [...new Set(excluded)].join(","));
      const response = await fetch(`/api/photos?${params}`);
      const data = await response.json() as { photo?: PhotoRecord; demo?: boolean; error?: string };
      if (!response.ok || !data.photo) throw new Error(data.error || "사진을 찾지 못했습니다.");
      setPhoto(data.photo);
      recentPhotoIds.current = [...recentPhotoIds.current.filter((id) => id !== data.photo!.id), data.photo!.id].slice(-100);
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
    const savedConditions = getSavedConditions();
    setRecentSearches(getSavedRecentSearches());
    const savedExcludedTerms = getSavedExcludedTerms();
    excludedTermsRef.current = savedExcludedTerms;
    setExcludedTerms(savedExcludedTerms);
    const urlParams = new URLSearchParams(window.location.search);
    const hasUrlConditions = ["tag", "q", "location", "source"].some((key) => urlParams.has(key));
    const urlSource = urlParams.get("source");
    const urlConditions: SearchConditions = {
      tag: (urlParams.get("tag") ?? urlParams.get("q") ?? "").trim().slice(0, 120),
      location: (urlParams.get("location") ?? "").trim().slice(0, 120),
      source: urlSource === "pexels" || urlSource === "openverse" ? urlSource : "all",
    };
    const initialConditions = hasUrlConditions ? urlConditions : savedConditions;
    const initialQuery = [initialConditions.tag, initialConditions.location].filter(Boolean).join(" ");
    const displayConditions = { ...initialConditions, tag: initialQuery, location: "" };
    setDeviceId(id);
    setTag(initialQuery);
    setLocation("");
    setSource(initialConditions.source);
    setConditions(displayConditions);
    if (hasUrlConditions) rememberConditions(displayConditions);
    void loadAlbums(id);
    void fetchPhoto(initialConditions, "", savedExcludedTerms);
  }, [fetchPhoto, loadAlbums]);

  function persistExcludedTerms(next: string[]) {
    const normalized = [...new Set(next.map((item) => item.trim()).filter(Boolean))].slice(0, 40);
    excludedTermsRef.current = normalized;
    setExcludedTerms(normalized);
    window.localStorage.setItem(excludedTermsStorageKey, JSON.stringify(normalized));
    return normalized;
  }

  async function addExcludedTerms(event: FormEvent) {
    event.preventDefault();
    const additions = excludedInput.split(",").map((item) => item.trim()).filter(Boolean);
    if (!additions.length) return;
    const next = persistExcludedTerms([...excludedTerms, ...additions]);
    setExcludedInput("");
    recentPhotoIds.current = [];
    await fetchPhoto(conditions, "", next);
  }

  async function removeExcludedTerm(term: string) {
    const next = persistExcludedTerms(excludedTerms.filter((item) => item !== term));
    recentPhotoIds.current = [];
    await fetchPhoto(conditions, "", next);
  }

  function rememberConditions(next: SearchConditions) {
    setConditions(next);
    window.localStorage.setItem(conditionsStorageKey, JSON.stringify(next));
    if (next.tag || next.location) {
      setRecentSearches((previous) => {
        const nextSearches = [next, ...previous.filter((item) => recentSearchKey(item) !== recentSearchKey(next))].slice(0, 10);
        window.localStorage.setItem(recentSearchesStorageKey, JSON.stringify(nextSearches));
        return nextSearches;
      });
    }
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    const next = { tag: tag.trim(), location: "", source };
    recentPhotoIds.current = [];
    rememberConditions(next);
    setView("discover");
    await fetchPhoto(next);
  }

  async function searchRecent(next: SearchConditions) {
    const allSourceNext = { tag: [next.tag, next.location].filter(Boolean).join(" "), location: "", source: "all" as const };
    setTag(allSourceNext.tag);
    setLocation(allSourceNext.location);
    setSource(allSourceNext.source);
    recentPhotoIds.current = [];
    rememberConditions(allSourceNext);
    setView("discover");
    await fetchPhoto(allSourceNext);
  }

  async function savePhoto() {
    if (!deviceId || !activeAlbumId || isSaved || photo.id === "loading") return;
    try {
      const response = await fetch("/api/album", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, albumId: activeAlbumId, photo }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error);
      await loadAlbums(deviceId, activeAlbumId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "앨범에 저장하지 못했습니다.");
    }
  }

  async function deleteItem(id: number) {
    const previous = album;
    setAlbum((items) => items.filter((item) => item.membershipId !== id));
    try {
      const response = await fetch(`/api/album?id=${id}&deviceId=${encodeURIComponent(deviceId)}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      await loadAlbums(deviceId, activeAlbumId);
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
        body: JSON.stringify({ deviceId, albumId: activeAlbumId, orderedIds: reordered.map((item) => item.membershipId) }),
      });
      if (!response.ok) throw new Error();
    } catch {
      setAlbum(album);
      setError("앨범 순서를 변경하지 못했습니다.");
    }
  }

  async function selectAlbum(albumId: number) {
    setActiveAlbumId(albumId);
    setDeleteConfirmAlbumId(0);
    setRenameAlbumId(0);
    setRenameAlbumName("");
    await loadAlbumItems(deviceId, albumId);
  }

  async function createAlbum(event: FormEvent) {
    event.preventDefault();
    const name = newAlbumName.trim();
    if (!name || !deviceId) return;
    try {
      const response = await fetch("/api/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, name }),
      });
      const data = await response.json() as { albumId?: number; error?: string };
      if (!response.ok || !data.albumId) throw new Error(data.error);
      setNewAlbumName("");
      await loadAlbums(deviceId, data.albumId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "앨범을 만들지 못했습니다.");
    }
  }

  async function renameAlbum(event: FormEvent) {
    event.preventDefault();
    const name = renameAlbumName.trim();
    if (!name || !renameAlbumId) return;
    try {
      const response = await fetch("/api/albums", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, albumId: renameAlbumId, name }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error);
      setRenameAlbumId(0);
      setRenameAlbumName("");
      await loadAlbums(deviceId, activeAlbumId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "앨범 이름을 변경하지 못했습니다.");
    }
  }

  async function deleteAlbum(albumId: number) {
    if (deleteConfirmAlbumId !== albumId) {
      setDeleteConfirmAlbumId(albumId);
      return;
    }
    try {
      const response = await fetch(`/api/albums?deviceId=${encodeURIComponent(deviceId)}&albumId=${albumId}`, { method: "DELETE" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error);
      setDeleteConfirmAlbumId(0);
      setRenameAlbumId(0);
      await loadAlbums(deviceId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "앨범을 삭제하지 못했습니다.");
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
          <button className={`nav-link ${view === "album" ? "active" : ""}`} type="button" onClick={() => setView("album")}>내 앨범 <span className="count">{totalSaved}</span></button>
        </nav>
      </header>

      {error && <div className="notice error-notice" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="알림 닫기">×</button></div>}

      {view === "discover" ? (
        <>
          <section className="hero" id="discover">
            <form className="search-card" onSubmit={search}>
              <label><span>검색어</span><input name="query" value={tag} onChange={(event) => setTag(event.target.value)} placeholder="예: 서울 고양이, 파리 건축, 여름" maxLength={120} /></label>
              <label className="source-field"><span>출처</span><select name="source" value={source} onChange={(event) => setSource(event.target.value as SearchConditions["source"])}><option value="pexels">Pexels</option><option value="openverse">Openverse</option><option value="all">모두</option></select></label>
              <button type="submit" disabled={loading}>사진 찾기 <span aria-hidden="true">→</span></button>
            </form>
            <div className="condition-row" aria-live="polite">
              {(conditions.tag || conditions.location) ? <><span>현재 조건</span>{conditions.tag && <b>#{conditions.tag}</b>}{conditions.location && <b>⌖ {conditions.location}</b>}</> : <span>조건 없이 오늘의 추천 사진을 만나보세요.</span>}
              {recentSearches.length > 0 && <><span className="recent-label">최근 검색</span>{recentSearches.map((item) => <button className="recent-search" type="button" key={`${item.source}-${item.tag}-${item.location}`} onClick={() => void searchRecent(item)}>{searchLabel(item)}</button>)}</>}
            </div>
            {demo && <p className="demo-note">Pexels API 키 연결 전 데모 모드입니다. 키를 추가하면 같은 화면에서 실제 Pexels 사진을 검색합니다.</p>}
          </section>

          <section className={`photo-stage ${loading ? "is-loading" : ""}`} aria-label="발견한 사진" aria-busy={loading}>
            <div className="photo-frame">
              <img src={photo.imageUrl} alt={cleanPhotoTitle(photo.title)} title="더블클릭하여 다른 사진 보기" onDoubleClick={() => { if (!loading) void fetchPhoto(conditions, photo.id); }} onLoad={() => setImageLoading(false)} onError={() => setImageLoading(false)} className={imageLoading ? "image-pending" : ""} />
              {(loading || imageLoading) && <div className="image-loader"><span /></div>}
              <div className="photo-actions">
                <div className="save-cluster">
                  <select value={activeAlbumId} onChange={(event) => void selectAlbum(Number(event.target.value))} aria-label="사진을 저장할 앨범">
                    {albums.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                  </select>
                  <button className={isSaved ? "saved" : ""} type="button" onClick={savePhoto} aria-label={isSaved ? `${activeAlbum?.name ?? "앨범"}에 저장됨` : `${activeAlbum?.name ?? "앨범"}에 저장`} disabled={isSaved || !activeAlbumId}>{isSaved ? "♥" : "♡"}</button>
                </div>
                <button type="button" onClick={() => fetchPhoto(conditions, photo.id)} disabled={loading}>다른 사진 <span aria-hidden="true">↻</span></button>
              </div>
            </div>
            <aside className="photo-caption">
              <div>
                <p className="photo-kicker">TODAY’S DISCOVERY</p>
                <h2>{cleanPhotoTitle(photo.title)}</h2>
                <p className="description">{photo.description}</p>
                <div className="source-links">
                  <a href={photo.sourceUrl} target="_blank" rel="noreferrer">{photo.id.startsWith("openverse-") ? "Openverse 사진 페이지" : "Pexels 사진 페이지"} ↗</a>
                  {photo.originalUrl && <a href={photo.originalUrl} target="_blank" rel="noreferrer">원본 파일 열기 ↗</a>}
                </div>
              </div>
              <dl>
                <div><dt>사진가</dt><dd><a href={photo.ownerId || photo.sourceUrl} target="_blank" rel="noreferrer">{photo.ownerName}</a></dd></div>
                {(photo.dateTaken || photo.dateUploaded) && <div><dt>{photo.dateTaken ? "촬영일" : "업로드일"}</dt><dd>{formatDate(photo.dateTaken ?? photo.dateUploaded)}</dd></div>}
                <div><dt>출처</dt><dd>{photo.id.startsWith("openverse-") ? "Openverse" : "Pexels"}</dd></div>
                <div><dt>검색 위치</dt><dd>{photo.locationName ?? (photo.latitude != null ? `${photo.latitude.toFixed(4)}, ${photo.longitude?.toFixed(4)}` : "지정하지 않음")}{photo.latitude != null && <a className="map-link" href={`https://www.openstreetmap.org/?mlat=${photo.latitude}&mlon=${photo.longitude}#map=12/${photo.latitude}/${photo.longitude}`} target="_blank" rel="noreferrer">지도 ↗</a>}</dd></div>
                {(photo.width || photo.height) && <div><dt>크기</dt><dd>{photo.width ?? "?"} × {photo.height ?? "?"} px</dd></div>}
                <div className="tags-row"><dt>태그</dt><dd>{visibleTags.length ? visibleTags.map((item) => <button className="tag" type="button" key={item} onClick={() => { const next = { tag: item, location: "", source }; setTag(item); setLocation(""); rememberConditions(next); void fetchPhoto(next); }}>{item}</button>) : <span>태그 없음</span>}</dd></div>
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

          <section className="exclusion-settings exclusion-settings-bottom" aria-label="제외어 관리">
            <div className="exclusion-heading"><span>제외어 관리</span><small>제목·설명·태그에 포함된 사진을 숨깁니다.</small></div>
            <form className="exclusion-form" onSubmit={addExcludedTerms}>
              <input value={excludedInput} onChange={(event) => setExcludedInput(event.target.value)} placeholder="예: 음식, 자동차 (쉼표로 구분)" maxLength={240} aria-label="추가할 제외어" />
              <button type="submit" disabled={!excludedInput.trim()}>추가</button>
            </form>
            <div className="exclusion-list" aria-label="현재 제외어">
              {excludedTerms.map((term) => <button type="button" className="exclusion-chip" key={term} onClick={() => void removeExcludedTerm(term)} title={`${term} 제외어 삭제`}>{term}<span aria-hidden="true">×</span></button>)}
            </div>
          </section>
        </>
      ) : (
        <section className="album-section" id="album">
          <div className="album-header"><div><p className="eyebrow">MY VISUAL ARCHIVE</p><h1>마음에 남은<br />장면들</h1></div><p>여러 앨범을 만들고 이름을 바꾸거나 삭제할 수 있습니다. 각 앨범 안에서는 사진 순서도 자유롭게 정리해보세요.</p></div>
          <div className="album-manager">
            <div className="album-tabs" role="tablist" aria-label="내 앨범 목록">
              {albums.map((item) => <button className={item.id === activeAlbumId ? "active" : ""} type="button" role="tab" aria-selected={item.id === activeAlbumId} key={item.id} onClick={() => void selectAlbum(item.id)}><span>{item.name}</span><small>{item.itemCount}</small></button>)}
            </div>
            <form className="album-create" onSubmit={createAlbum}>
              <label htmlFor="new-album-name">새 앨범</label>
              <input id="new-album-name" value={newAlbumName} onChange={(event) => setNewAlbumName(event.target.value)} placeholder="예: 서울의 밤" maxLength={50} />
              <button type="submit" disabled={!newAlbumName.trim()}>만들기</button>
            </form>
          </div>
          {activeAlbum && <div className="active-album-bar">
            {renameAlbumId === activeAlbum.id ? <form onSubmit={renameAlbum} className="album-rename"><input value={renameAlbumName} onChange={(event) => setRenameAlbumName(event.target.value)} maxLength={50} autoFocus aria-label="새 앨범 이름" /><button type="submit" disabled={!renameAlbumName.trim()}>저장</button><button type="button" onClick={() => setRenameAlbumId(0)}>취소</button></form> : <div><div><small>선택한 앨범</small><h2>{activeAlbum.name}</h2></div><div className="album-management-actions"><button type="button" onClick={() => { setRenameAlbumId(activeAlbum.id); setRenameAlbumName(activeAlbum.name); setDeleteConfirmAlbumId(0); }}>이름 변경</button><button className={deleteConfirmAlbumId === activeAlbum.id ? "confirm-delete" : ""} type="button" onClick={() => void deleteAlbum(activeAlbum.id)}>{deleteConfirmAlbumId === activeAlbum.id ? "정말 삭제" : "앨범 삭제"}</button>{deleteConfirmAlbumId === activeAlbum.id && <button type="button" onClick={() => setDeleteConfirmAlbumId(0)}>취소</button>}</div></div>}
          </div>}
          {album.length ? <div className="album-grid">{album.map((item, index) => (
            <article className="album-card" key={item.membershipId}>
              <button className="album-photo" type="button" onClick={() => openAlbumPhoto(item)}><img src={item.imageUrl} alt={cleanPhotoTitle(item.title)} /><span>자세히 보기 ↗</span></button>
              <div className="album-card-copy"><div><small>{String(index + 1).padStart(2, "0")}</small><h2>{cleanPhotoTitle(item.title)}</h2><p>{item.ownerName}</p></div><div className="album-controls"><button type="button" onClick={() => moveItem(index, -1)} disabled={index === 0} aria-label="앞으로 이동">←</button><button type="button" onClick={() => moveItem(index, 1)} disabled={index === album.length - 1} aria-label="뒤로 이동">→</button><button className="delete" type="button" onClick={() => deleteItem(item.membershipId)}>삭제</button></div></div>
            </article>
          ))}</div> : <div className="empty-album"><span>○</span><h2>{activeAlbum?.name ?? "이 앨범"}은 아직 비어 있습니다.</h2><p>발견 화면에서 저장할 앨범을 선택하고 하트를 눌러보세요.</p><button type="button" onClick={() => setView("discover")}>사진 발견하러 가기 →</button></div>}
        </section>
      )}

      <footer><div className="brand"><span className="brand-mark">●</span> FILMPICK</div><p>Pexels와 Openverse의 공개 사진을 이용합니다. 사진 저작권과 라이선스는 각 사진가 및 원출처에 있습니다.</p><a href="https://openverse.org" target="_blank" rel="noreferrer">Photos from Pexels &amp; Openverse ↗</a></footer>
    </main>
  );
}
