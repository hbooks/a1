/// <reference path="../types.d.ts" />

import { neon } from '@neondatabase/serverless';

export const onRequestPost: PagesFunction = async (context) => {
    const { request, env } = context;
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (!env.DATABASE_URL) {
        return new Response(JSON.stringify({ error: 'Database configuration missing' }), { status: 500 });
    }

    const sql = neon(env.DATABASE_URL);

    try {
        const body = await request.json();

        if (action === 'create') {
            const { roomCode, hostId, hostName } = body;

            try {
                const room = await sql`
          INSERT INTO cardi_rooms (room_code, host_id, status) 
          VALUES (${roomCode}, ${hostId}, 'waiting') 
          RETURNING id
        `;

                await sql`
          INSERT INTO cardi_room_players (room_id, user_id, player_name, seat_index) 
          VALUES (${room[0].id}, ${hostId}, ${hostName}, 0)
        `;

                return new Response(JSON.stringify({ success: true, roomId: room[0].id }), {
                    status: 200, headers: { 'Content-Type': 'application/json' }
                });
            } catch (dbError: any) {
                // 23505 is the Postgres error code for "Unique Violation"
                if (dbError.code === '23505') {
                    return new Response(JSON.stringify({ error: 'You already have an active room. Finish it or leave it first.' }), {
                        status: 403, headers: { 'Content-Type': 'application/json' }
                    });
                }
                throw dbError;
            }
        }

        if (action === 'join') {
            const { roomCode, userId, playerName } = body;
            const rooms = await sql`SELECT id, status FROM cardi_rooms WHERE room_code = ${roomCode}`;

            if (rooms.length === 0) return new Response(JSON.stringify({ error: 'Room not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
            if (rooms[0].status !== 'waiting') return new Response(JSON.stringify({ error: 'Game already started' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

            const roomId = rooms[0].id;
            const players = await sql`SELECT COUNT(*) as count FROM cardi_room_players WHERE room_id = ${roomId}`;
            const seatIndex = parseInt(players[0].count);

            if (seatIndex >= 4) return new Response(JSON.stringify({ error: 'Room is full' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

            await sql`
        INSERT INTO cardi_room_players (room_id, user_id, player_name, seat_index) 
        VALUES (${roomId}, ${userId}, ${playerName}, ${seatIndex})
      `;

            return new Response(JSON.stringify({ success: true, roomId, seatIndex }), {
                status: 200, headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    } catch (error: any) {
        console.error('API Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
};