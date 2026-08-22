# FILMPICK

태그와 위치로 Pexels의 공개 사진을 한 장씩 발견하고, 메타데이터를 살펴보고, 코멘트와 개인 앨범을 남길 수 있는 웹서비스입니다.

## 주요 기능

- 태그·위치 단독 검색 및 교집합 검색
- 동일 조건에서 다른 사진 추천
- 원본 페이지, 원본 파일, 사진가, 촬영일, 위치, 크기, 태그 표시
- 사진별 코멘트 작성
- D1 기반 개인 앨범 저장, 순서 변경, 삭제
- 모바일·데스크톱 반응형 화면

## 로컬 실행

Node.js 22 이상과 pnpm이 필요합니다.

```bash
pnpm install
cp .env.example .env
pnpm run dev
```

`.env`의 `PEXELS_API_KEY`에 [Pexels API Key](https://www.pexels.com/api/)를 입력합니다. 키가 없으면 데모 사진으로 모든 화면과 앨범·코멘트 기능을 확인할 수 있습니다.

## 데이터

앨범과 코멘트는 Cloudflare D1에 저장됩니다. 데이터 구조와 마이그레이션은 `db/`와 `drizzle/`에 있습니다.

사진 저작권은 각 Pexels 사진가에게 있습니다. 서비스 운영 시 [Pexels API 문서](https://www.pexels.com/api/documentation/)와 [Pexels 이용약관](https://www.pexels.com/terms-of-service/)을 확인하세요.
