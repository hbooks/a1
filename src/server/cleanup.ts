import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;

const STALE_AFTER = "1 hour";   // change here to tune the window
const CHUNK = 5000;             // rows per DELETE statement (keeps a single txn small)

export type CleanupResult = {
    ok: true;
    window: string;
    movesDeleted: number;
    roomsDeleted: number;       // players removed by cascade are counted separately below
    playersDeleted: number;     // measured via RETURNING on cascade-affected players is unreliable, so we measure rooms only
    activeRoomsKept: number;
    durationMs: number;
};

/**
 * Delete data older than STALE_AFTER.
 *
 * Rules (all "activity-based", never "created_at-based" for live rooms):
 *   1. A room is "active" if ANY player has last_seen > now() - STALE_AFTER.
 *   2. Delete cardi_moves rows that are (a) older than STALE_AFTER AND (b) belong to
 *      a room_code that is NOT currently active. This protects in-progress games.
 *   3. Delete rooms that are NOT active AND were created before STALE_AFTER.
 *      cardi_room_players is removed automatically by ON DELETE CASCADE.
 *   4. Any player row left orphaned (no matching room) is removed defensively.
 *
 * Safe to run concurrently: every step is idempotent. Re-running is a no-op.
 * Bounded: deletes in CHUNK-sized batches so a huge backlog cannot lock the DB.
 */
export async function cleanupOldData(sql: Sql): Promise<CleanupResult> {
    const t0 = Date.now();
    let movesDeleted = 0;
    let roomsDeleted = 0;
    let playersDeleted = 0;

    /* ------------------------------------------------------------------
     * Step 1 — delete old moves that do NOT belong to a live room.
     *
     * A move is eligible only if its room is either already gone (room_code
     * not in cardi_rooms) OR its room is dead (no player last_seen in window).
     * Looped in chunks so we never hold a giant transaction.
     * ------------------------------------------------------------------ */
    for (; ;) {
        const batch = (await sql`
            WITH dead_codes AS (
                SELECT r.room_code
                FROM cardi_rooms r
                WHERE NOT EXISTS (
                    SELECT 1 FROM cardi_room_players p
                    WHERE p.room_id = r.id
                      AND p.last_seen > now() - interval '1 hour'
                )
            ),
            victims AS (
                SELECT ctid
                FROM cardi_moves m
                WHERE m.created_at < now() - interval '1 hour'
                  AND (
                      m.room_code NOT IN (SELECT room_code FROM cardi_rooms)
                      OR m.room_code IN (SELECT room_code FROM dead_codes)
                  )
                LIMIT ${CHUNK}
            )
            DELETE FROM cardi_moves m
            USING victims v
            WHERE m.ctid = v.ctid
            RETURNING 1 AS x
        `) as unknown as { x: number }[];
        if (batch.length === 0) break;
        movesDeleted += batch.length;
        if (batch.length < CHUNK) break;
    }

    /* ------------------------------------------------------------------
     * Step 2 — delete dead rooms. Cascade removes their players.
     * We loop too, so a backlog doesn't take a single huge lock.
     * ------------------------------------------------------------------ */
    for (; ;) {
        const batch = (await sql`
            WITH victims AS (
                SELECT id FROM cardi_rooms r
                WHERE r.created_at < now() - interval '1 hour'
                  AND NOT EXISTS (
                      SELECT 1 FROM cardi_room_players p
                      WHERE p.room_id = r.id
                        AND p.last_seen > now() - interval '1 hour'
                  )
                LIMIT ${CHUNK}
            )
            DELETE FROM cardi_rooms r
            USING victims v
            WHERE r.id = v.id
            RETURNING 1 AS x
        `) as unknown as { x: number }[];
        if (batch.length === 0) break;
        roomsDeleted += batch.length;
        if (batch.length < CHUNK) break;
    }

    /* ------------------------------------------------------------------
     * Step 3 — defensive orphan sweep. If a schema change ever removed
     * the cascade, or a partial failure left players behind, this catches it.
     * Normally deletes 0 rows.
     * ------------------------------------------------------------------ */
    for (; ;) {
        const batch = (await sql`
            WITH victims AS (
                SELECT p.ctid
                FROM cardi_room_players p
                WHERE NOT EXISTS (
                    SELECT 1 FROM cardi_rooms r WHERE r.id = p.room_id
                )
                LIMIT ${CHUNK}
            )
            DELETE FROM cardi_room_players p
            USING victims v
            WHERE p.ctid = v.ctid
            RETURNING 1 AS x
        `) as unknown as { x: number }[];
        if (batch.length === 0) break;
        playersDeleted += batch.length;
        if (batch.length < CHUNK) break;
    }

    /* ------------------------------------------------------------------
     * Step 4 — telemetry: how many live rooms did we deliberately keep?
     * Useful in logs so you can tell "cleanup ran" from "cleanup nuked".
     * ------------------------------------------------------------------ */
    const kept = (await sql`
        SELECT COUNT(*)::int AS n
        FROM cardi_rooms r
        WHERE EXISTS (
            SELECT 1 FROM cardi_room_players p
            WHERE p.room_id = r.id
              AND p.last_seen > now() - interval '1 hour'
        )
    `) as unknown as { n: number }[];

    return {
        ok: true,
        window: STALE_AFTER,
        movesDeleted,
        roomsDeleted,
        playersDeleted,
        activeRoomsKept: kept[0]?.n ?? 0,
        durationMs: Date.now() - t0,
    };
}