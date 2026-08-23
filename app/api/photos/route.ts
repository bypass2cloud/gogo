import { env } from "cloudflare:workers";
import { ensureSchema, getD1 } from "../../../db";
import type { PhotoRecord } from "../../../lib/types";

const endpoint = "https://api.pexels.com/v1";
const openverseEndpoint = "https://api.openverse.org/v1/images/";
const openverseTokenEndpoint = "https://api.openverse.org/v1/auth_tokens/token/";
let openverseTokenPromise: Promise<string> | null = null;
let openverseTokenExpiresAt = 0;
let openverseRateLimitedUntil = 0;
const openverseResponseCache = new Map<string, { expiresAt: number; data: OpenverseResponse }>();

const demos: PhotoRecord[] = [
  {
    id: "pexels-demo-417074",
    title: "호수 너머의 산",
    description: "Pexels API 키를 연결하기 전에도 탐색과 앨범 기능을 확인할 수 있는 데모 사진입니다.",
    imageUrl: "https://images.pexels.com/photos/417074/pexels-photo-417074.jpeg?auto=compress&cs=tinysrgb&w=1800",
    originalUrl: "https://images.pexels.com/photos/417074/pexels-photo-417074.jpeg",
    sourceUrl: "https://www.pexels.com/photo/417074/",
    ownerId: "https://www.pexels.com/",
    ownerName: "Pexels Demo",
    dateTaken: null,
    dateUploaded: null,
    latitude: null,
    longitude: null,
    locationName: "자연",
    tags: ["mountain", "lake", "nature"],
    license: "Pexels License",
    width: 1800,
    height: 1200,
  },
  {
    id: "pexels-demo-1105766",
    title: "도시의 불빛",
    description: "도시와 건축을 주제로 준비한 Pexels 데모 사진입니다.",
    imageUrl: "https://images.pexels.com/photos/1105766/pexels-photo-1105766.jpeg?auto=compress&cs=tinysrgb&w=1800",
    originalUrl: "https://images.pexels.com/photos/1105766/pexels-photo-1105766.jpeg",
    sourceUrl: "https://www.pexels.com/photo/1105766/",
    ownerId: "https://www.pexels.com/",
    ownerName: "Pexels Demo",
    dateTaken: null,
    dateUploaded: null,
    latitude: null,
    longitude: null,
    locationName: "도시",
    tags: ["city", "night", "architecture"],
    license: "Pexels License",
    width: 1800,
    height: 1200,
  },
  {
    id: "pexels-demo-167699",
    title: "숲에 내리는 빛",
    description: "고요한 숲과 햇살을 담은 Pexels 데모 사진입니다.",
    imageUrl: "https://images.pexels.com/photos/167699/pexels-photo-167699.jpeg?auto=compress&cs=tinysrgb&w=1800",
    originalUrl: "https://images.pexels.com/photos/167699/pexels-photo-167699.jpeg",
    sourceUrl: "https://www.pexels.com/photo/167699/",
    ownerId: "https://www.pexels.com/",
    ownerName: "Pexels Demo",
    dateTaken: null,
    dateUploaded: null,
    latitude: null,
    longitude: null,
    locationName: "숲",
    tags: ["forest", "light", "nature"],
    license: "Pexels License",
    width: 1800,
    height: 1200,
  },
];

type PexelsPhoto = {
  id: number;
  width: number;
  height: number;
  url?: string;
  photographer: string;
  photographer_url: string;
  alt?: string;
  src: {
    original: string;
    large2x?: string;
    large?: string;
    landscape?: string;
  };
};

type OpenversePhoto = {
  id: string;
  title?: string;
  description?: string;
  url: string;
  thumbnail?: string;
  creator?: string;
  creator_url?: string;
  foreign_landing_url?: string;
  license?: string;
  license_version?: string;
  license_url?: string;
  width?: number;
  height?: number;
  tags?: Array<{ name?: string } | string>;
};

type OpenverseResponse = { results?: OpenversePhoto[]; page_count?: number; page?: number };

async function pexels(path: string, apiKey: string, params: Record<string, string>) {
  const query = new URLSearchParams(params);
  const response = await fetch(`${endpoint}${path}?${query}`, {
    headers: { Accept: "application/json", Authorization: apiKey },
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Pexels API 키가 올바르지 않습니다.");
    if (response.status === 429) throw new Error("Pexels API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.");
    throw new Error("Pexels에서 사진을 불러오지 못했습니다.");
  }
  return response.json() as Promise<{ photos?: PexelsPhoto[] }>;
}

async function getOpenverseToken(clientId: string, clientSecret: string, bootstrapToken = "") {
  if (openverseTokenPromise && Date.now() < openverseTokenExpiresAt - 60_000) return openverseTokenPromise;
  openverseTokenPromise = (async () => {
    await ensureSchema();
    const cached = await getD1().prepare("SELECT access_token, expires_at FROM openverse_tokens WHERE id = 1").first<{ access_token: string; expires_at: number }>();
    if (cached && Number(cached.expires_at) > Date.now() + 60_000) {
      openverseTokenExpiresAt = Number(cached.expires_at);
      return cached.access_token;
    }
    if (bootstrapToken) {
      openverseTokenExpiresAt = Date.now() + 12 * 60 * 60 * 1000;
      await getD1().prepare(`INSERT INTO openverse_tokens (id, access_token, expires_at) VALUES (1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET access_token = excluded.access_token, expires_at = excluded.expires_at`)
        .bind(bootstrapToken, openverseTokenExpiresAt).run();
      return bootstrapToken;
    }
    const tokenResponse = await fetch(openverseTokenEndpoint, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
    });
    if (!tokenResponse.ok) throw new Error(`Openverse 인증에 실패했습니다. (${tokenResponse.status})`);
    const tokenData = await tokenResponse.json() as { access_token?: string; expires_in?: number };
    if (!tokenData.access_token) throw new Error("Openverse 인증 토큰을 받지 못했습니다.");
    openverseTokenExpiresAt = Date.now() + (tokenData.expires_in ?? 3600) * 1000;
    await getD1().prepare(`INSERT INTO openverse_tokens (id, access_token, expires_at) VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET access_token = excluded.access_token, expires_at = excluded.expires_at`)
      .bind(tokenData.access_token, openverseTokenExpiresAt).run();
    return tokenData.access_token;
  })();
  try {
    return await openverseTokenPromise;
  } catch (error) {
    openverseTokenPromise = null;
    openverseTokenExpiresAt = 0;
    throw error;
  }
}

async function openverse(params: Record<string, string>, clientId: string, clientSecret: string, bootstrapToken = "") {
  const token = await getOpenverseToken(clientId, clientSecret, bootstrapToken);
  const query = new URLSearchParams(params);
  const cacheKey = query.toString();
  const cached = openverseResponseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  if (openverseRateLimitedUntil > Date.now()) throw new Error("Openverse에서 사진을 불러오지 못했습니다. (429)");
  const response = await fetch(`${openverseEndpoint}?${query}`, { headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "User-Agent": "FILMPICK/1.0 (photo discovery)" } });
  if (!response.ok) {
    if (response.status === 429) openverseRateLimitedUntil = Date.now() + 30_000;
    throw new Error(`Openverse에서 사진을 불러오지 못했습니다. (${response.status})`);
  }
  const data = await response.json() as OpenverseResponse;
  openverseResponseCache.set(cacheKey, { expiresAt: Date.now() + 30_000, data });
  if (openverseResponseCache.size > 80) {
    const oldestKey = openverseResponseCache.keys().next().value;
    if (oldestKey) openverseResponseCache.delete(oldestKey);
  }
  return data;
}

async function openverseSearch(params: Record<string, string>, clientId: string, clientSecret: string, nonce: number, bootstrapToken = "") {
  const firstPage = await openverse({ ...params, page: "1" }, clientId, clientSecret, bootstrapToken);
  const pageCount = Math.max(1, Number(firstPage.page_count ?? 1));
  const page = (Math.abs(nonce) % pageCount) + 1;
  return page === 1 ? firstPage : openverse({ ...params, page: String(page) }, clientId, clientSecret, bootstrapToken);
}

function normalizeSearchText(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function cleanPhotoTitle(value: string | null | undefined) {
  const cleaned = (value ?? "")
    .replace(/#[\p{L}\p{N}_-]+/gu, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s|,;·•]+|[\s|,;·•]+$/g, "")
    .trim();
  return cleaned || "제목 없는 사진";
}

function matchesEveryCondition(photo: PexelsPhoto, tag: string, location: string) {
  const description = normalizeSearchText(photo.alt ?? "");
  const requiredTerms = [tag, location]
    .flatMap((value) => value.split(/[\s,]+/))
    .map(normalizeSearchText)
    .filter(Boolean);
  return requiredTerms.every((term) => description.includes(term));
}

function matchesOpenverse(photo: OpenversePhoto, tag: string, location: string) {
  const haystack = normalizeSearchText([photo.title, photo.description, ...(photo.tags ?? []).map((tag) => typeof tag === "string" ? tag : tag.name ?? "")].filter(Boolean).join(" "));
  const requiredTerms = [tag, location].flatMap((value) => value.split(/[\s,]+/)).map(normalizeSearchText).filter(Boolean);
  return requiredTerms.every((term) => haystack.includes(term));
}

function containsExcludedTerm(text: string, excludedTerms: string[]) {
  const haystack = normalizeSearchText(text);
  return excludedTerms.some((term) => {
    const normalized = normalizeSearchText(term);
    return normalized && haystack.includes(normalized);
  });
}

function isExcludedPexels(photo: PexelsPhoto, excludedTerms: string[]) {
  return containsExcludedTerm(photo.alt ?? "", excludedTerms);
}

function isExcludedOpenverse(photo: OpenversePhoto, excludedTerms: string[]) {
  return containsExcludedTerm([photo.title, photo.description, ...(photo.tags ?? []).map((tag) => typeof tag === "string" ? tag : tag.name ?? "")].filter(Boolean).join(" "), excludedTerms);
}

function toOpenverseRecord(raw: OpenversePhoto, location: string): PhotoRecord {
  const title = cleanPhotoTitle(raw.title);
  return {
    id: `openverse-${raw.id}`,
    title,
    description: raw.description?.trim() || title,
    imageUrl: raw.url || raw.thumbnail || "https://openverse.org/",
    originalUrl: raw.url || raw.thumbnail || null,
    sourceUrl: raw.foreign_landing_url || "https://openverse.org/",
    ownerId: raw.creator_url || raw.foreign_landing_url || "https://openverse.org/",
    ownerName: raw.creator?.trim() || "Openverse 기여자",
    dateTaken: null,
    dateUploaded: null,
    latitude: null,
    longitude: null,
    locationName: location || null,
    tags: (raw.tags ?? []).map((item) => typeof item === "string" ? item : item.name ?? "").filter(Boolean).slice(0, 16),
    license: [raw.license, raw.license_version].filter(Boolean).join(" ") || null,
    width: raw.width || null,
    height: raw.height || null,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tag = (url.searchParams.get("tag") ?? "").trim().slice(0, 120);
  const location = (url.searchParams.get("location") ?? "").trim().slice(0, 120);
  const source = url.searchParams.get("source") === "openverse" ? "openverse" : url.searchParams.get("source") === "all" ? "all" : "pexels";
  const exclude = url.searchParams.get("exclude") ?? "";
  const excludedTerms = (url.searchParams.get("excludeTerms") ?? "").split(",").map((item) => item.trim().slice(0, 60)).filter(Boolean).slice(0, 40);
  const excludedIds = new Set(exclude.split(",").map((item) => item.trim()).filter(Boolean));
  const nonce = Number(url.searchParams.get("nonce") ?? Date.now());
  const apiKey = (env as unknown as { PEXELS_API_KEY?: string }).PEXELS_API_KEY?.trim();
  const openverseClientId = (env as unknown as { OPENVERSE_CLIENT_ID?: string }).OPENVERSE_CLIENT_ID?.trim();
  const openverseClientSecret = (env as unknown as { OPENVERSE_CLIENT_SECRET?: string }).OPENVERSE_CLIENT_SECRET?.trim();
  const openverseBootstrapToken = (env as unknown as { OPENVERSE_ACCESS_TOKEN?: string }).OPENVERSE_ACCESS_TOKEN?.trim();

  if (!apiKey && source === "pexels") {
    const available = demos.filter((photo) => !excludedIds.has(photo.id) && !containsExcludedTerm([photo.title, photo.description, ...photo.tags].join(" "), excludedTerms));
    const photo = available[Math.abs(nonce) % available.length] ?? demos[0];
    return Response.json({ photo, demo: true });
  }

  try {
    const searchTerms = [tag, location].filter(Boolean).join(" ");
    const openverseRequest = source !== "pexels"
      ? openverseSearch({ q: searchTerms || "nature", page_size: "50" }, openverseClientId ?? "", openverseClientSecret ?? "", nonce, openverseBootstrapToken ?? "")
        .catch((error) => source === "all" ? { results: [] } : Promise.reject(error))
      : Promise.resolve({ results: [] });
    const [pexelsData, openverseData] = await Promise.all([
      (source !== "openverse" && apiKey) ? (searchTerms ? pexels("/search", apiKey, { query: searchTerms, locale: "ko-KR", per_page: "80", page: "1" }) : pexels("/curated", apiKey, { per_page: "80", page: "1" })) : Promise.resolve({ photos: [] }),
      openverseRequest,
    ]);
    const pexelsList = (pexelsData.photos ?? []).filter((item) => !excludedIds.has(`pexels-${item.id}`) && !isExcludedPexels(item, excludedTerms) && (!searchTerms || matchesEveryCondition(item, tag, location)));
    const openverseList = (openverseData.results ?? []).filter((item) => (item.url || item.thumbnail) && !excludedIds.has(`openverse-${item.id}`) && !isExcludedOpenverse(item, excludedTerms) && (!searchTerms || matchesOpenverse(item, tag, location)));
    const candidates = source === "openverse" ? openverseList.map((item) => toOpenverseRecord(item, location)) : [
      ...pexelsList.map((raw) => ({
        id: `pexels-${raw.id}`, title: cleanPhotoTitle(raw.alt), description: raw.alt?.trim() || "Pexels 사진가가 공개한 사진입니다.", imageUrl: raw.src.large2x ?? raw.src.landscape ?? raw.src.large ?? raw.src.original, originalUrl: raw.src.original, sourceUrl: raw.url, ownerId: raw.photographer_url || raw.url, ownerName: raw.photographer || "Pexels Photographer", dateTaken: null, dateUploaded: null, latitude: null, longitude: null, locationName: location || null, tags: [], license: "Pexels License", width: raw.width || null, height: raw.height || null,
      } satisfies PhotoRecord)),
      ...openverseList.map((item) => toOpenverseRecord(item, location)),
    ];
    if (!candidates.length) return Response.json({ error: "선택한 출처에서 모든 검색 조건에 맞는 사진을 찾지 못했습니다." }, { status: 404 });
    return Response.json({ photo: candidates[Math.abs(nonce) % candidates.length], demo: false });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "사진 검색에 실패했습니다." }, { status: 502 });
  }
}
