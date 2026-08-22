import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const albumItems = sqliteTable("album_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deviceId: text("device_id").notNull(),
  photoId: text("photo_id").notNull(),
  position: integer("position").notNull().default(0),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  imageUrl: text("image_url").notNull(),
  originalUrl: text("original_url"),
  // The legacy column name is retained so existing deployed albums remain compatible.
  sourceUrl: text("flickr_url").notNull(),
  ownerId: text("owner_id").notNull(),
  ownerName: text("owner_name").notNull(),
  dateTaken: text("date_taken"),
  dateUploaded: text("date_uploaded"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  locationName: text("location_name"),
  tags: text("tags").notNull().default("[]"),
  license: text("license"),
  width: integer("width"),
  height: integer("height"),
  savedAt: text("saved_at").notNull(),
}, (table) => [
  uniqueIndex("idx_album_device_photo").on(table.deviceId, table.photoId),
  index("idx_album_device_position").on(table.deviceId, table.position),
]);

export const albums = sqliteTable("albums", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deviceId: text("device_id").notNull(),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_albums_device_name").on(table.deviceId, table.name),
  index("idx_albums_device_position").on(table.deviceId, table.position),
]);

export const albumPhotos = sqliteTable("album_photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  albumId: integer("album_id").notNull().references(() => albums.id, { onDelete: "cascade" }),
  itemId: integer("item_id").notNull().references(() => albumItems.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  savedAt: text("saved_at").notNull(),
}, (table) => [
  uniqueIndex("idx_album_photos_album_item").on(table.albumId, table.itemId),
  index("idx_album_photos_album_position").on(table.albumId, table.position),
]);

export const albumMigrations = sqliteTable("album_migrations", {
  deviceId: text("device_id").primaryKey(),
  migratedAt: text("migrated_at").notNull(),
});

export const comments = sqliteTable("comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  photoId: text("photo_id").notNull(),
  deviceId: text("device_id").notNull(),
  authorName: text("author_name").notNull(),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_comments_photo_created").on(table.photoId, table.createdAt),
]);
