import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from "drizzle-orm/sqlite-core";

export const projectStates = sqliteTable("project_states", {
  userId: text("user_id").primaryKey(),
  payload: text("payload").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
export const projectTileCorrections = sqliteTable(
  "project_tile_corrections",
  {
    userId: text("user_id").notNull(),
    tileId: integer("tile_id").notNull(),
    payload: text("payload").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.tileId] })],
);
