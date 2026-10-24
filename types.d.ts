// types.d.ts
interface Env {
    DATABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    SUPABASE_URL: string;
}

type PagesFunction<T = any> = (context: { request: Request; env: Env }) => Promise<Response>;