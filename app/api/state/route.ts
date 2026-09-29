import { env } from "cloudflare:workers";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

async function correctionTable(db: NonNullable<typeof env.DB>) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS project_tile_corrections (
    user_id TEXT NOT NULL, tile_id INTEGER NOT NULL, payload TEXT NOT NULL,
    PRIMARY KEY (user_id, tile_id)
  )`,
    )
    .run();
}

async function volumeTable(db: NonNullable<typeof env.DB>) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS project_volume_vectors (
    user_id TEXT NOT NULL, volume_id TEXT NOT NULL, payload TEXT NOT NULL,
    PRIMARY KEY (user_id, volume_id)
  )`).run();
}

async function identity() {
  const h = await headers();
  return h.get("oai-authenticated-user-id") ?? "local_seedy";
}

export async function GET() {
  const userId = await identity();
  if (!env.DB) return Response.json({ payload: null, unavailable: true });
  await correctionTable(env.DB);
  await volumeTable(env.DB);
  const [state,corrections,volumes]=await env.DB.batch([
    env.DB.prepare('SELECT payload, updated_at AS updatedAt FROM project_states WHERE user_id = ?').bind(userId),
    env.DB.prepare('SELECT tile_id, payload FROM project_tile_corrections WHERE user_id = ?').bind(userId),
    env.DB.prepare('SELECT volume_id, payload FROM project_volume_vectors WHERE user_id = ?').bind(userId),
  ]);
  const row=state.results[0] as {payload:string;updatedAt:number}|undefined;
  if (!row) return Response.json({ payload: null });
  const payload = JSON.parse(row.payload);
  const byTile = new Map(
    (corrections.results as {tile_id:number;payload:string}[]).map((c) => [c.tile_id, JSON.parse(c.payload)]),
  );
  if (Array.isArray(payload.tiles))
    payload.tiles = payload.tiles.map((tile: { id: number }) =>
      byTile.has(tile.id) ? { ...tile, correction: byTile.get(tile.id) } : tile,
    );
  const byVolume = new Map(
    (volumes.results as {volume_id:string;payload:string}[]).map(row => [row.volume_id, JSON.parse(row.payload)]),
  );
  if (Array.isArray(payload.volumes))
    payload.volumes = payload.volumes.map((volume: { id: string; faces: unknown }) =>
      byVolume.has(volume.id) ? { ...volume, faces: byVolume.get(volume.id) } : volume,
    );
  return Response.json({ payload, updatedAt: row.updatedAt });
}

export async function PUT(request: Request) {
  const userId = await identity();
  if (!env.DB)
    return Response.json(
      { error: "Project storage is unavailable." },
      { status: 503 },
    );
  const db = env.DB;
  const payload = (await request.json()) as {
    tiles: ({ id: number; correction?: unknown } & Record<string, unknown>)[];
    volumes?: ({ id: string; faces?: Record<string, { tileId: number; correction?: unknown }> } & Record<string, unknown>)[];
    assemblies?: { id: string; name: string; blocks: { id: string; volumeId: string; position: number[] }[]; fused: boolean }[];
    assemblyDraft?: { blocks: { id: string; volumeId: string; position: number[] }[]; fused: boolean };
  };
  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray(payload.tiles) ||
    payload.tiles.length > 100
  )
    return Response.json({ error: "Invalid project." }, { status: 400 });
  const corrections: { id: number; payload: string }[] = [];
  const volumeVectors: { id: string; payload: string }[] = [];
  const ids = new Set<number>();
  for (const tile of payload.tiles) {
    if (!tile || !Number.isInteger(tile.id) || ids.has(tile.id))
      return Response.json({ error: "Invalid tile IDs." }, { status: 400 });
    ids.add(tile.id);
    if (tile.correction) {
      const encoded = JSON.stringify(tile.correction);
      if (encoded.length > 1_500_000)
        return Response.json(
          { error: "A tile correction is too large." },
          { status: 413 },
        );
      corrections.push({ id: tile.id, payload: encoded });
    }
  }
  if (payload.volumes !== undefined) {
    if (!Array.isArray(payload.volumes) || payload.volumes.length > 100)
      return Response.json({ error: "Invalid 3D object library." }, { status: 400 });
    const volumeIds = new Set<string>();
    for (const volume of payload.volumes) {
      if (!volume || typeof volume.id !== "string" || volume.id.length > 100 || volumeIds.has(volume.id) ||
          !volume.faces || typeof volume.faces !== "object" || Object.keys(volume.faces).length > 8 ||
          (volume.shape !== undefined && volume.shape !== "cube" && volume.shape !== "hex-prism"))
        return Response.json({ error: "Invalid 3D object." }, { status: 400 });
      volumeIds.add(volume.id);
      const encodedFaces = JSON.stringify(volume.faces);
      if (encodedFaces.length > 1_500_000)
        return Response.json({ error: "A 3D object is too large." }, { status: 413 });
      volumeVectors.push({ id: volume.id, payload: encodedFaces });
    }
  }
  const volumeIds = new Set(payload.volumes?.map(volume => volume.id) ?? []);
  const validBlocks = (blocks: unknown) => Array.isArray(blocks) && blocks.length <= 100 && blocks.every(block =>
    block && typeof block.id === "string" && block.id.length <= 100 &&
    typeof block.volumeId === "string" && volumeIds.has(block.volumeId) &&
    Array.isArray(block.position) && block.position.length === 3 &&
    block.position.every((value: unknown) => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 100));
  if (payload.assemblyDraft !== undefined && (!payload.assemblyDraft || !validBlocks(payload.assemblyDraft.blocks) || typeof payload.assemblyDraft.fused !== "boolean"))
    return Response.json({ error: "Invalid cube builder draft." }, { status: 400 });
  if (payload.assemblies !== undefined && (!Array.isArray(payload.assemblies) || payload.assemblies.length > 100 ||
    payload.assemblies.some(assembly => !assembly || typeof assembly.id !== "string" || assembly.id.length > 100 ||
      typeof assembly.name !== "string" || assembly.name.length > 100 || !validBlocks(assembly.blocks) || typeof assembly.fused !== "boolean")))
    return Response.json({ error: "Invalid cube builder assembly." }, { status: 400 });
  const encoded = JSON.stringify({
    ...payload,
    tiles: payload.tiles.map((tile) => {
      const saved = { ...tile };
      delete saved.correction;
      return saved;
    }),
    volumes: payload.volumes?.map(volume => ({
      ...volume,
      faces: Object.fromEntries(Object.entries(volume.faces ?? {}).map(([name, face]) => [name, { tileId: face.tileId }])),
    })),
  });
  if (encoded.length > 900_000)
    return Response.json(
      { error: "Project record is too large." },
      { status: 413 },
    );
  const now = Date.now();
  await correctionTable(db);
  await volumeTable(db);
  await db.batch([
    db
      .prepare(
        `
    INSERT INTO project_states (user_id, payload, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
  `,
      )
      .bind(userId, encoded, now),
    db
      .prepare("DELETE FROM project_tile_corrections WHERE user_id = ?")
      .bind(userId),
    ...corrections.map((c) =>
      db
        .prepare(
          "INSERT INTO project_tile_corrections (user_id,tile_id,payload) VALUES (?,?,?)",
        )
        .bind(userId, c.id, c.payload),
    ),
    ...(payload.volumes ? [db.prepare("DELETE FROM project_volume_vectors WHERE user_id = ?").bind(userId)] : []),
    ...volumeVectors.map(volume => db.prepare(
      "INSERT INTO project_volume_vectors (user_id,volume_id,payload) VALUES (?,?,?)",
    ).bind(userId, volume.id, volume.payload)),
  ]);
  return Response.json({ saved: true, updatedAt: now });
}
