export type PhotoRecord = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  originalUrl: string | null;
  sourceUrl: string;
  ownerId: string;
  ownerName: string;
  dateTaken: string | null;
  dateUploaded: string | null;
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  tags: string[];
  license: string | null;
  width: number | null;
  height: number | null;
};

export type AlbumItem = PhotoRecord & {
  membershipId: number;
  albumId: number;
  position: number;
  savedAt: string;
};

export type AlbumSummary = {
  id: number;
  name: string;
  position: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CommentRecord = {
  id: number;
  photoId: string;
  authorName: string;
  body: string;
  createdAt: string;
};
