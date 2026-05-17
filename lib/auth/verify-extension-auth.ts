import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

/**
 * Verify authentication from extension (Bearer token) or web (cookie).
 * Extension sends: Authorization: Bearer <supabase_access_token>
 * Web sends: cookies with session
 */
export async function verifyAuth(request: Request) {
  // Try Bearer token first (extension)
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      }
    );
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) {
      return { user: data.user, supabase };
    }
  }

  // Fallback: cookie-based auth (web)
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    return { user: data.user, supabase };
  }

  return null;
}
