import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Redirect user to dashboard or specified redirect URL
      redirect(next);
    } else {
      // Redirect the user to an error page with instructions
      redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
    }
  }

  // Redirect the user to an error page if no code is provided
  redirect(`/auth/error?error=${encodeURIComponent("No authorization code provided")}`);
}
