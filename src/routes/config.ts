import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/config")({
    server: {
        handlers: {
            GET: async ({ request }) => {
                // Check if the request is coming from our game
                const isGameRequest = request.headers.get("x-cardi-client") === "true";

                if (!isGameRequest) {
                    // If a user just types /config in the browser, return a simple OK
                    return new Response("OK", { status: 200 });
                }

                // If it IS the game, return the keys
                return new Response(JSON.stringify({
                    supabaseUrl: process.env['SUPABASE_URL'],
                    supabaseKey: process.env['SUPABASE_ANON_KEY'],
                }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            },
        },
    },
});