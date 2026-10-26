import { createFileRoute } from "@tanstack/react-router";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Cardi rooms API  (POST /api?action=create | join | status | leave)
 *
 * Lifecycle
 *  - create : host picks a name + max players (2-4, host included). Server makes the room code.
 *  - join   : player picks a name, enters the code. Seat = lowest free seat.
 *  - status : polled by every client in the waiting room (also the heartbeat).
 *             When the last seat fills, the room flips to 'playing' with a shared seed.
 *  - leave  : a guest just frees their seat. If the HOST leaves, the room is deleted.
 *  - Ghost cleanup: anyone silent for STALE_SECS is dropped (host silent => room deleted).
 *
 * Run cardi_migration.sql in Neon once before using this file.
 */

type Sql = NeonQueryFunction<false, false>; // exactly what neon(url) returns
type Id = string | number;
type RoomRow = { id: Id; status: string; max_players: number | null; seed: string | number | null };

const STALE_SECS = 90; // generous: players may switch to WhatsApp to share the code
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const fail = (status: number, code: string, error: string) => json({ error, code }, status);

function rows<T>(r: unknown): T[] {
    return r as T[];
}
const cleanName = (v: unknown) =>
    String(v ?? "")
        .replace(/\p{Cc}/gu, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 14);
const normCode = (v: unknown) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const validId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(v);
const makeCode = () =>
    Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");

const MSG_NOT_FOUND =
    "We couldn't find that room. It may have closed, so double-check the code or ask the host for a new one.";

async function findRoom(sql: Sql, code: string): Promise<RoomRow | undefined> {
    return rows<RoomRow>(
        await sql`SELECT id, status, max_players, seed FROM cardi_rooms WHERE room_code = ${code}`,
    )[0];
}

async function destroyRoom(sql: Sql, roomId: Id) {
    await sql`DELETE FROM cardi_moves WHERE room_code = (SELECT room_code FROM cardi_rooms WHERE id = ${roomId})`;
    await sql`DELETE FROM cardi_room_players WHERE room_id = ${roomId}`;
    await sql`DELETE FROM cardi_rooms WHERE id = ${roomId}`;
}

/** Drops silent guests; deletes the room if the host went silent. Returns false if the room is gone. */
async function pruneRoom(sql: Sql, roomId: Id): Promise<boolean> {
    const host = rows<{ stale: boolean }>(
        await sql`
      SELECT (p.last_seen < now() - make_interval(secs => ${STALE_SECS})) AS stale
      FROM cardi_room_players p
      JOIN cardi_rooms r ON r.id = p.room_id AND r.host_id = p.user_id
      WHERE p.room_id = ${roomId}`,
    )[0];
    if (!host || host.stale) {
        await destroyRoom(sql, roomId);
        return false;
    }
    await sql`
    DELETE FROM cardi_room_players p
    USING cardi_rooms r
    WHERE p.room_id = ${roomId} AND r.id = p.room_id AND p.user_id <> r.host_id
      AND p.last_seen < now() - make_interval(secs => ${STALE_SECS})`;
    return true;
}

/** A person can only be in one waiting room at a time. Their hosted rooms are deleted. */
async function leaveEverywhere(sql: Sql, userId: string, exceptRoomId?: Id) {
    const hosted = rows<{ id: Id }>(
        await sql`SELECT id FROM cardi_rooms WHERE host_id = ${userId}`,
    );
    for (const r of hosted) {
        if (exceptRoomId !== undefined && String(r.id) === String(exceptRoomId)) continue;
        await destroyRoom(sql, r.id);
    }
    if (exceptRoomId !== undefined) {
        await sql`
      DELETE FROM cardi_room_players
      WHERE user_id = ${userId}
        AND room_id IN (SELECT id FROM cardi_rooms WHERE status = 'waiting' AND id <> ${exceptRoomId})`;
    } else {
        await sql`
      DELETE FROM cardi_room_players
      WHERE user_id = ${userId}
        AND room_id IN (SELECT id FROM cardi_rooms WHERE status = 'waiting')`;
    }
}

/** Waiting rooms nobody has touched for a long time (closed tabs) are removed. */
async function sweepAbandoned(sql: Sql) {
    await sql`DELETE FROM cardi_moves WHERE created_at < now() - interval '1 day'`;
    await sql`
    DELETE FROM cardi_room_players
    WHERE room_id IN (
      SELECT r.id FROM cardi_rooms r
      WHERE r.status = 'waiting' AND NOT EXISTS (
        SELECT 1 FROM cardi_room_players p
        WHERE p.room_id = r.id AND p.last_seen > now() - make_interval(secs => ${STALE_SECS * 2})))`;
    await sql`
    DELETE FROM cardi_rooms r
    WHERE r.status = 'waiting' AND NOT EXISTS (SELECT 1 FROM cardi_room_players p WHERE p.room_id = r.id)`;
}

function safeEqual(a: string, b: string) {
    if (a.length !== b.length) return false;
    let d = 0;
    for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
}

/** Called by cron-job.org (header "Authorization: Bearer <CRON_SECRET>"). Removes finished / abandoned rooms. */
async function runCleanup(request: Request) {
    const secret = process.env["CRON_SECRET"];
    const dbUrl = process.env["DATABASE_URL"];
    if (!secret || !dbUrl) return fail(503, "disabled", "CRON_SECRET or DATABASE_URL is not set.");
    const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!safeEqual(given, secret)) return fail(401, "unauthorized", "Unauthorized");
    const sql = neon(dbUrl);

    // A room is idle when nothing happened in it for an hour (no move, no heartbeat).
    const idle = rows<{ id: Id }>(
        await sql`
      SELECT r.id FROM cardi_rooms r
      WHERE GREATEST(
              COALESCE((SELECT MAX(m.created_at) FROM cardi_moves m WHERE m.room_code = r.room_code), '-infinity'::timestamptz),
              COALESCE((SELECT MAX(p.last_seen) FROM cardi_room_players p WHERE p.room_id = r.id), '-infinity'::timestamptz)
            ) < now() - interval '1 hour'
      LIMIT 500`,
    );
    for (const r of idle) await destroyRoom(sql, r.id);

    const moves = rows<{ x: number }>(
        await sql`DELETE FROM cardi_moves m
              WHERE m.created_at < now() - interval '1 hour'
                AND NOT EXISTS (SELECT 1 FROM cardi_rooms r WHERE r.room_code = m.room_code)
              RETURNING 1 AS x`,
    );
    const players = rows<{ x: number }>(
        await sql`DELETE FROM cardi_room_players p
              WHERE NOT EXISTS (SELECT 1 FROM cardi_rooms r WHERE r.id = p.room_id)
              RETURNING 1 AS x`,
    );
    return json({ ok: true, roomsDeleted: idle.length, orphanMoves: moves.length, orphanPlayers: players.length });
}

export const Route = createFileRoute("/api")({
    server: {
        handlers: {
            // Health check: open https://a.hpbooks.uk/api in the browser
            GET: async ({ request }) => {
                if (new URL(request.url).searchParams.get("action") === "cleanup") return runCleanup(request);
                return json({ ok: true, hasDb: !!process.env["DATABASE_URL"] });
            },

            POST: async ({ request }) => {
                const url = new URL(request.url);
                const action = url.searchParams.get("action");
                if (action === "cleanup") return runCleanup(request);

                const dbUrl = process.env["DATABASE_URL"];
                if (!dbUrl) return fail(500, "server", "Database configuration missing");
                const sql = neon(dbUrl);

                let body: any;
                try {
                    body = await request.json();
                } catch {
                    return fail(400, "bad_request", "Invalid JSON body");
                }

                try {
                    /* ------------------------------ CREATE ------------------------------ */
                    if (action === "create") {
                        const hostId = body.hostId;
                        const name = cleanName(body.hostName);
                        const maxPlayers = Math.round(Number(body.maxPlayers));
                        if (!validId(hostId)) return fail(400, "bad_request", "Missing player id.");
                        if (!name) return fail(400, "bad_name", "Pick a name so your friends know who you are.");
                        if (!(maxPlayers >= 2 && maxPlayers <= 4))
                            return fail(400, "bad_request", "Rooms hold between 2 and 4 players.");

                        await leaveEverywhere(sql, hostId);
                        await sweepAbandoned(sql);

                        for (let i = 0; i < 6; i++) {
                            const code = makeCode();
                            try {
                                // Room + host seat in ONE statement, so a room can never exist without its host.
                                const made = rows<{ room_id: Id }>(
                                    await sql`
                    WITH r AS (
                      INSERT INTO cardi_rooms (room_code, host_id, status, max_players)
                      VALUES (${code}, ${hostId}, 'waiting', ${maxPlayers})
                      RETURNING id
                    )
                    INSERT INTO cardi_room_players (room_id, user_id, player_name, seat_index, last_seen)
                    SELECT id, ${hostId}, ${name}, 0, now() FROM r
                    RETURNING room_id`,
                                );
                                return json({
                                    success: true,
                                    roomId: made[0]?.room_id,
                                    roomCode: code,
                                    maxPlayers,
                                    seatIndex: 0,
                                });
                            } catch (e: any) {
                                if (e.code === "23505" && String(e.detail ?? "").includes("room_code")) continue;
                                throw e;
                            }
                        }
                        return fail(503, "busy", "Couldn't allocate a room code. Please try again.");
                    }

                    /* ------------------------------- JOIN ------------------------------- */
                    if (action === "join") {
                        const roomCode = normCode(body.roomCode);
                        const userId = body.userId;
                        const name = cleanName(body.playerName);
                        if (roomCode.length !== 6) return fail(400, "bad_code", "Room codes have 6 characters.");
                        if (!validId(userId)) return fail(400, "bad_request", "Missing player id.");
                        if (!name) return fail(400, "bad_name", "Pick a name so your friends know who you are.");

                        const room = await findRoom(sql, roomCode);
                        if (!room) return fail(404, "not_found", MSG_NOT_FOUND);
                        if (room.status === "waiting" && !(await pruneRoom(sql, room.id)))
                            return fail(404, "not_found", MSG_NOT_FOUND);
                        const maxPlayers = room.max_players ?? 4;

                        // Already seated here (double tap / reconnect): just refresh.
                        const existing = rows<{ seat_index: number }>(
                            await sql`SELECT seat_index FROM cardi_room_players WHERE room_id = ${room.id} AND user_id = ${userId}`,
                        )[0];
                        if (existing) {
                            await sql`UPDATE cardi_room_players SET player_name = ${name}, last_seen = now()
                        WHERE room_id = ${room.id} AND user_id = ${userId}`;
                            return json({ success: true, roomId: room.id, roomCode, seatIndex: existing.seat_index, maxPlayers });
                        }

                        if (room.status !== "waiting")
                            return fail(409, "started", "That game has already started.");

                        await leaveEverywhere(sql, userId, room.id);

                        const taken = rows<{ x: number }>(
                            await sql`SELECT 1 AS x FROM cardi_room_players
                        WHERE room_id = ${room.id} AND lower(player_name) = lower(${name})`,
                        );
                        if (taken.length > 0)
                            return fail(409, "name_taken", "Someone in that room already uses that name. Try another one.");

                        let seat = -1;
                        for (let attempt = 0; attempt < 3 && seat < 0; attempt++) {
                            const free = rows<{ s: number }>(
                                await sql`
                  SELECT s FROM generate_series(0, ${maxPlayers} - 1) AS s
                  WHERE s NOT IN (SELECT seat_index FROM cardi_room_players WHERE room_id = ${room.id})
                  ORDER BY s LIMIT 1`,
                            )[0];
                            if (!free) break;
                            try {
                                await sql`
                  INSERT INTO cardi_room_players (room_id, user_id, player_name, seat_index, last_seen)
                  VALUES (${room.id}, ${userId}, ${name}, ${free.s}, now())`;
                                seat = free.s;
                            } catch (e: any) {
                                if (e.code !== "23505") throw e; // seat grabbed by someone else a moment ago: retry
                            }
                        }
                        if (seat < 0) return fail(409, "full", "That room is already full.");

                        const count =
                            rows<{ n: number }>(
                                await sql`SELECT COUNT(*)::int AS n FROM cardi_room_players WHERE room_id = ${room.id}`,
                            )[0]?.n ?? 0;
                        if (count >= maxPlayers) {
                            // Last seat filled: flip to playing and give everybody the same shuffle seed.
                            await sql`UPDATE cardi_rooms
                        SET status = 'playing', seed = ${Math.floor(Math.random() * 2147483646) + 1}
                        WHERE id = ${room.id} AND status = 'waiting'`;
                        }
                        return json({ success: true, roomId: room.id, roomCode, seatIndex: seat, maxPlayers });
                    }

                    /* ------------------------------ STATUS ------------------------------ */
                    if (action === "status") {
                        const roomCode = normCode(body.roomCode);
                        const userId = body.userId;
                        if (roomCode.length !== 6 || !validId(userId)) return fail(400, "bad_request", "Bad request.");

                        const room = await findRoom(sql, roomCode);
                        if (!room) return json({ closed: true, reason: "not_found" });

                        // Heartbeat first, so a slow tab is never pruned by its own request.
                        const beat = rows<{ x: number }>(
                            await sql`UPDATE cardi_room_players SET last_seen = now()
                        WHERE room_id = ${room.id} AND user_id = ${userId} RETURNING 1 AS x`,
                        );
                        if (beat.length === 0) return json({ closed: true, reason: "removed" });

                        if (room.status === "waiting" && !(await pruneRoom(sql, room.id)))
                            return json({ closed: true, reason: "host_left" });

                        const players = rows<{ seat_index: number; player_name: string; is_host: boolean; is_you: boolean }>(
                            await sql`
                SELECT p.seat_index, p.player_name,
                       (p.user_id = r.host_id) AS is_host,
                       (p.user_id = ${userId}) AS is_you
                FROM cardi_room_players p
                JOIN cardi_rooms r ON r.id = p.room_id
                WHERE p.room_id = ${room.id}
                ORDER BY p.seat_index`,
                        );
                        if (!players.some((p) => p.is_you)) return json({ closed: true, reason: "removed" });

                        return json({
                            closed: false,
                            status: room.status,
                            maxPlayers: room.max_players ?? 4,
                            seed: room.seed == null ? null : Number(room.seed),
                            players: players.map((p) => ({
                                seat: p.seat_index,
                                name: p.player_name,
                                isHost: p.is_host,
                                isYou: p.is_you,
                            })),
                        });
                    }

                    /* ------------------------------- LEAVE ------------------------------ */
                    if (action === "leave") {
                        const roomCode = normCode(body.roomCode);
                        const userId = body.userId;
                        if (roomCode.length !== 6 || !validId(userId)) return json({ success: true });

                        const room = await findRoom(sql, roomCode);
                        if (room && room.status === "waiting") {
                            const isHost =
                                rows<{ x: number }>(
                                    await sql`SELECT 1 AS x FROM cardi_rooms WHERE id = ${room.id} AND host_id = ${userId}`,
                                ).length > 0;
                            if (isHost) await destroyRoom(sql, room.id); // host leaves => room closes for everyone
                            else await sql`DELETE FROM cardi_room_players WHERE room_id = ${room.id} AND user_id = ${userId}`;
                        }
                        return json({ success: true });
                    }

                    /* -------------------- MOVE LOG (the shared game) -------------------- */
                    // Every action in a match is one row with the next sequence number. The primary key
                    // (room_code, seq) guarantees exactly one winner when two devices send at the same moment.
                    if (action === "move") {
                        const roomCode = normCode(body.roomCode);
                        const userId = body.userId;
                        const seq = Math.floor(Number(body.seq));
                        const mv = body.move;
                        if (roomCode.length !== 6 || !validId(userId)) return fail(400, "bad_request", "Bad request.");
                        if (!(seq >= 1 && seq < 100000)) return fail(400, "bad_request", "Bad sequence number.");
                        if (!mv || typeof mv !== "object" || !["play", "draw", "pass", "declare", "start", "pause", "resume", "rematch"].includes(mv.type))
                            return fail(400, "bad_request", "Unknown move.");
                        const text = JSON.stringify({ ...mv, ts: Date.now() }); // server clock, so every device agrees on 'when'
                        if (text.length > 4000) return fail(400, "bad_request", "Move too large.");

                        const me = rows<{ seat_index: number; status: string }>(
                            await sql`
                SELECT p.seat_index, r.status
                FROM cardi_room_players p JOIN cardi_rooms r ON r.id = p.room_id
                WHERE r.room_code = ${roomCode} AND p.user_id = ${userId}`,
                        )[0];
                        if (!me || me.status !== "playing") return fail(403, "not_in_game", "You are not in this game.");

                        let accepted = false;
                        try {
                            const ins = rows<{ seq: number }>(
                                await sql`
                  INSERT INTO cardi_moves (room_code, seq, player_index, payload)
                  SELECT ${roomCode}::text, ${seq}::int, ${me.seat_index}::int, ${text}::jsonb
                  WHERE ${seq}::int = COALESCE((SELECT MAX(m.seq) FROM cardi_moves m WHERE m.room_code = ${roomCode}::text), 0) + 1
                  RETURNING seq`,
                            );
                            accepted = ins.length > 0;
                        } catch (e: any) {
                            if (e.code !== "23505") throw e; // someone else took this number a moment ago
                        }
                        // Always answer with the log from this number on (ours if accepted, the winner's if not).
                        const moves = rows<{ seq: number; player_index: number; payload: unknown }>(
                            await sql`SELECT seq, player_index, payload FROM cardi_moves
                        WHERE room_code = ${roomCode}::text AND seq >= ${seq}::int ORDER BY seq LIMIT 200`,
                        );
                        return json({
                            accepted,
                            now: Date.now(),
                            moves: moves.map((m) => ({ seq: m.seq, player: m.player_index, move: m.payload })),
                        });
                    }

                    if (action === "leave_game") {
                        const roomCode = normCode(body.roomCode);
                        const userId = body.userId;
                        if (roomCode.length !== 6 || !validId(userId)) return json({ success: true });
                        const me = rows<{ seat_index: number; status: string }>(
                            await sql`
                SELECT p.seat_index, r.status
                FROM cardi_room_players p JOIN cardi_rooms r ON r.id = p.room_id
                WHERE r.room_code = ${roomCode} AND p.user_id = ${userId}`,
                        )[0];
                        if (!me || me.status !== "playing") return json({ success: true });
                        const text = JSON.stringify({ type: "leave", ts: Date.now() });
                        for (let i = 0; i < 6; i++) {
                            try {
                                await sql`
                  INSERT INTO cardi_moves (room_code, seq, player_index, payload)
                  SELECT ${roomCode}::text, COALESCE(MAX(m.seq), 0) + 1, ${me.seat_index}::int, ${text}::jsonb
                  FROM cardi_moves m WHERE m.room_code = ${roomCode}::text`;
                                break;
                            } catch (e: any) {
                                if (e.code !== "23505") throw e; // someone else took that number: try the next one
                            }
                        }
                        return json({ success: true });
                    }

                    if (action === "events") {
                        const roomCode = normCode(body.roomCode);
                        const userId = body.userId;
                        const since = Math.max(0, Math.floor(Number(body.since)) || 0);
                        if (roomCode.length !== 6 || !validId(userId)) return fail(400, "bad_request", "Bad request.");
                        const moves = rows<{ seq: number; player_index: number; payload: unknown }>(
                            await sql`
                SELECT m.seq, m.player_index, m.payload
                FROM cardi_moves m
                WHERE m.room_code = ${roomCode}::text AND m.seq > ${since}::int
                  AND EXISTS (
                    SELECT 1 FROM cardi_room_players p JOIN cardi_rooms r ON r.id = p.room_id
                    WHERE r.room_code = ${roomCode}::text AND p.user_id = ${userId})
                ORDER BY m.seq LIMIT 200`,
                        );
                        return json({ now: Date.now(), moves: moves.map((m) => ({ seq: m.seq, player: m.player_index, move: m.payload })) });
                    }

                    return fail(400, "bad_request", "Invalid action");
                } catch (error: any) {
                    console.error("API Error:", error);
                    return fail(500, "server", error?.message ?? "Server error");
                }
            },
        },
    },
});