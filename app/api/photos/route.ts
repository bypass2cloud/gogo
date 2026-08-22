import { env } from "cloudflare:workers";
import type { PhotoRecord } from "../../../lib/types";

const endpoint = "https://api.pexels.com/v1";

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
  url: string;
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

function normalizeSearchText(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function matchesEveryCondition(photo: PexelsPhoto, tag: string, location: string) {
  const description = normalizeSearchText(photo.alt ?? "");
  const requiredTerms = [tag, location]
    .flatMap((value) => value.split(/[\s,]+/))
    .map(normalizeSearchText)
    .filter(Boolean);
  return requiredTerms.every((term) => description.includes(term));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tag = (url.searchParams.get("tag") ?? "").trim().slice(0, 120);
  const location = (url.searchParams.get("location") ?? "").trim().slice(0, 120);
  const exclude = url.searchParams.get("exclude") ?? "";
  const nonce = Number(url.searchParams.get("nonce") ?? Date.now());
  const apiKey = (env as unknown as { PEXELS_API_KEY?: string }).PEXELS_API_KEY?.trim();

  if (!apiKey) {
    const available = demos.filter((photo) => photo.id !== exclude);
    const photo = available[Math.abs(nonce) % available.length] ?? demos[0];
    return Response.json({ photo, demo: true });
  }

  try {
    const searchTerms = [tag, location].filter(Boolean).join(" ");
    const data = searchTerms
      ? await pexels("/search", apiKey, { query: searchTerms, locale: "ko-KR", per_page: "80", page: "1" })
      : await pexels("/curated", apiKey, { per_page: "80", page: "1" });
    const list = (data.photos ?? []).filter((item) =>
      `pexels-${item.id}` !== exclude && (!searchTerms || matchesEveryCondition(item, tag, location))
    );
    if (!list.length) return Response.json({ error: "사진 설명에 모든 검색 조건이 포함된 사진을 찾지 못했습니다." }, { status: 404 });
    const raw = list[Math.abs(nonce) % list.length];
    const searchTags = tag.split(/[\s,]+/).filter(Boolean).slice(0, 16);
    const imageUrl = raw.src.large2x ?? raw.src.landscape ?? raw.src.large ?? raw.src.original;

    const photo: PhotoRecord = {
      id: `pexels-${raw.id}`,
      title: raw.alt?.trim() || "제목 없는 사진",
      description: raw.alt?.trim() || "Pexels 사진가가 공개한 사진입니다.",
      imageUrl,
      originalUrl: raw.src.original,
      sourceUrl: raw.url,
      ownerId: raw.photographer_url || raw.url,
      ownerName: raw.photographer || "Pexels Photographer",
      dateTaken: null,
      dateUploaded: null,
      latitude: null,
      longitude: null,
      locationName: location || null,
      tags: searchTags,
      license: "Pexels License",
      width: raw.width || null,
      height: raw.height || null,
    };
    return Response.json({ photo, demo: false });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "사진 검색에 실패했습니다." }, { status: 502 });
  }
}
