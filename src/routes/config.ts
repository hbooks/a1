import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/config")({
    server: {
        handlers: {
            GET: async () => {
                return new Response(JSON.stringify({
                    // Use bracket notation to fix the TypeScript error
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