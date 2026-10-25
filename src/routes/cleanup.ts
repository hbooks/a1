import { createFileRoute } from "@tanstack/react-router";
import { neon } from "@neondatabase/serverless";
import { cleanupOldData } from "../server/cleanup"; // adjust path

export const Route = createFileRoute("/cleanup")({
    server: {
        handlers: {
            GET: async ({ request }) => {
                const url = new URL(request.url);
                const secret = process.env["CLEANUP_SECRET"];
                if (!secret || url.searchParams.get("secret") !== secret) {
                    return new Response(JSON.stringify({ error: "unauthorized" }), {
                        status: 401,
                        headers: { "Content-Type": "application/json" },
                    });
                }
                const dbUrl = process.env["DATABASE_URL"];
                if (!dbUrl) {
                    return new Response(JSON.stringify({ error: "no db" }), {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    });
                }
                try {
                    const sql = neon(dbUrl);
                    const result = await cleanupOldData(sql);
                    console.log("[cleanup]", JSON.stringify(result));
                    return new Response(JSON.stringify(result), {
                        status: 200,
                        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
                    });
                } catch (e: any) {
                    console.error("[cleanup] failed", e);
                    return new Response(JSON.stringify({ error: e?.message ?? "server" }), {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    });
                }
            },
        },
    },
});