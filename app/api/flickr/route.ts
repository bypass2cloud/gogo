import { env } from "cloudflare:workers";
import type { PhotoRecord } from "../../../lib/types";

const endpoint = "https://www.flickr.com/services/rest/";

const demos: PhotoRecord[] = [
  {
    id: "demo-1",
    title: "바람이 머문 해안",
    description: "Flickr API 키를 연결하기 전에도 완성된 탐색 경험을 확인할 수 있는 데모 사진입니다.",
    imageUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1800&q=88",
    originalUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
    flickrUrl: "https://www.flickr.com/explore",
    ownerId: "demo",
    ownerName: "FILMPICK Demo",
    dateTaken: "2025-06-14 18:42:00",
    dateUploaded: null,
    latitude: 37.5665,
    longitude: 126.978,
    locationName: "Seoul, Korea",
    tags: ["coast", "summer", "light"],
    license: "demo",
    width: 1800,
    height: 1200,
  },
  {
    id: "demo-2",
    title: "고요한 산의 아침",
    description: "안개 사이로 번지는 빛과 산의 능선을 담은 데모 사진입니다.",
    imageUrl: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1800&q=88",
    originalUrl: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b",
    flickrUrl: "https://www.flickr.com/explore",
    ownerId: "demo",
    ownerName: "FILMPICK Demo",
    dateTaken: "2025-04-02 06:14:00",
    dateUploaded: null,
    latitude: 46.8182,
    longitude: 8.2275,
    locationName: "Swiss Alps",
    tags: ["mountain", "mist", "morning"],
    license: "demo",
    width: 1800,
    height: 1200,
  },
  {
    id: "demo-3",
    title: "도시의 푸른 시간",
    description: "해가 진 뒤 잠시 찾아오는 푸른 시간, 도시의 불빛이 켜지기 시작한 순간입니다.",
    imageUrl: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1800&q=88",
    originalUrl: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df",
    flickrUrl: "https://www.flickr.com/explore",
    ownerId: "demo",
    ownerName: "FILMPICK Demo",
    dateTaken: "2025-08-20 19:31:00",
    dateUploaded: null,
    latitude: 40.7128,
    longitude: -74.006,
    locationName: "New York, USA",
    tags: ["city", "bluehour", "architecture"],
    license: "demo",
    width: 1800,
    height: 1200,
  },
];

function cleanText(value: unknown) {
  const raw = typeof value === "string"
    ? value
    : typeof value === "object" && value && "_content" in value
      ? String((value as { _content?: string })._content ?? "")
      : "";
  return raw
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 420);
}

async function flickr(method: string, apiKey: string, params: Record<string, string>) {
  const query = new URLSearchParams({ method, api_key: apiKey, format: "json", nojsoncallback: "1", ...params });
  const response = await fetch(`${endpoint}?${query}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Flickr에서 사진을 불러오지 못했습니다.");
  const data = await response.json() as Record<string, unknown>;
  if (data.stat !== "ok") throw new Error(String(data.message ?? "Flickr 검색에 실패했습니다."));
  return data;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tag = (url.searchParams.get("tag") ?? "").trim().slice(0, 120);
  const location = (url.searchParams.get("location") ?? "").trim().slice(0, 120);
  const exclude = url.searchParams.get("exclude") ?? "";
  const nonce = Number(url.searchParams.get("nonce") ?? Date.now());
  const apiKey = (env as unknown as { FLICKR_API_KEY?: string }).FLICKR_API_KEY?.trim();

  if (!apiKey) {
    const available = demos.filter((photo) => photo.id !== exclude);
    const photo = available[Math.abs(nonce) % available.length] ?? demos[0];
    return Response.json({ photo, demo: true });
  }

  try {
    let placeId = "";
    let resolvedLocation = location;
    if (location) {
      const placeData = await flickr("flickr.places.find", apiKey, { query: location });
      const places = (placeData.places as { place?: Array<Record<string, unknown>> } | undefined)?.place ?? [];
      const place = places[0];
      if (!place) return Response.json({ error: "입력한 위치를 Flickr에서 찾지 못했습니다." }, { status: 404 });
      placeId = String(place.place_id ?? "");
      resolvedLocation = cleanText(place._content) || location;
    }

    const baseParams: Record<string, string> = {
      safe_search: "1",
      content_types: "0",
      media: "photos",
      sort: tag ? "relevance" : "interestingness-desc",
      per_page: "100",
      extras: "description,license,date_upload,date_taken,owner_name,original_format,geo,tags,o_dims,path_alias,url_z,url_c,url_l,url_o",
    };
    if (tag) {
      baseParams.tags = tag.split(/[\s,]+/).filter(Boolean).join(",");
      baseParams.tag_mode = "all";
    }
    if (placeId) {
      baseParams.place_id = placeId;
      baseParams.has_geo = "1";
      if (!tag) baseParams.min_upload_date = "1";
    }
    if (!tag && !placeId) baseParams.text = "travel landscape";

    const first = await flickr("flickr.photos.search", apiKey, { ...baseParams, page: "1" });
    const firstPhotos = first.photos as { pages?: number; photo?: Array<Record<string, unknown>> } | undefined;
    const pages = Math.max(1, Math.min(Number(firstPhotos?.pages ?? 1), 40));
    const targetPage = 1 + (Math.abs(nonce) % pages);
    const data = targetPage === 1
      ? first
      : await flickr("flickr.photos.search", apiKey, { ...baseParams, page: String(targetPage) });
    const list = ((data.photos as { photo?: Array<Record<string, unknown>> } | undefined)?.photo ?? [])
      .filter((item) => String(item.id) !== exclude);
    if (!list.length) return Response.json({ error: "조건에 맞는 다른 사진을 찾지 못했습니다." }, { status: 404 });
    const raw = list[Math.abs(nonce * 31) % list.length];

    const id = String(raw.id);
    const ownerId = String(raw.owner);
    const tags = String(raw.tags ?? "").split(/\s+/).filter(Boolean).slice(0, 16);
    const latitude = Number(raw.latitude);
    const longitude = Number(raw.longitude);
    const imageUrl = String(raw.url_l ?? raw.url_c ?? raw.url_z ?? "");
    if (!imageUrl) throw new Error("표시할 수 있는 크기의 사진이 없습니다.");

    const photo: PhotoRecord = {
      id,
      title: cleanText(raw.title) || "제목 없는 사진",
      description: cleanText(raw.description) || "사진가가 남긴 설명이 없습니다.",
      imageUrl,
      originalUrl: raw.url_o ? String(raw.url_o) : null,
      flickrUrl: `https://www.flickr.com/photos/${encodeURIComponent(ownerId)}/${encodeURIComponent(id)}`,
      ownerId,
      ownerName: cleanText(raw.ownername) || "Flickr Photographer",
      dateTaken: raw.datetaken ? String(raw.datetaken) : null,
      dateUploaded: raw.dateupload ? new Date(Number(raw.dateupload) * 1000).toISOString() : null,
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
      locationName: resolvedLocation || null,
      tags,
      license: raw.license == null ? null : String(raw.license),
      width: Number(raw.width_o ?? raw.width_l) || null,
      height: Number(raw.height_o ?? raw.height_l) || null,
    };
    return Response.json({ photo, demo: false });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "사진 검색에 실패했습니다." }, { status: 502 });
  }
}
