export type PhotoRecord = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  originalUrl: string | null;
  flickrUrl: string;
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
  albumId: number;
  position: number;
  savedAt: string;
};

export type CommentRecord = {
  id: number;
  photoId: string;
  authorName: string;
  body: string;
  createdAt: string;
};
