// lib/db/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Next 15: cookies() is async; @supabase/ssr doesn't accept a `headers` option.
export async function supabaseServer() {
  const cookieStore = await cookies();
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(url, anon, {
    cookies: {
      // Read-only is sufficient for standard SSR queries
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      // If you later need auth flows that set cookies server-side, uncomment these:
      // set(name: string, value: string, options?: import('next/dist/compiled/@edge-runtime/cookies').CookieSerializeOptions) {
      //   // @ts-expect-error: Next 15 types differ between environments; this is fine at runtime.
      //   cookieStore.set(name, value, options);
      // },
      // remove(name: string, options?: import('next/dist/compiled/@edge-runtime/cookies').CookieSerializeOptions) {
      //   // @ts-expect-error
      //   cookieStore.set(name, '', { ...options, expires: new Date(0) });
      // },
    },
  });
}
