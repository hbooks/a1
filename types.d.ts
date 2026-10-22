// types.d.ts
interface Env {
    DATABASE_URL: string;
}

type PagesFunction<T = any> = (context: { request: Request; env: Env }) => Promise<Response>;