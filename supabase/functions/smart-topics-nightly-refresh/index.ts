// Supabase Scheduled Edge Function
// - Runs on a schedule (e.g. daily 2:00)
// - Calls the app's cron endpoint to do the heavy refresh work

const REFRESH_URL = (Deno.env.get("SMART_TOPICS_REFRESH_URL") || "").trim();
const CRON_SECRET = (Deno.env.get("KNOWLEDGE_CRON_SECRET") || "").trim();

Deno.serve(async (req) => {
  try {
    if (!REFRESH_URL) {
      return new Response(JSON.stringify({ error: "SMART_TOPICS_REFRESH_URL is not configured" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
    if (!CRON_SECRET) {
      return new Response(JSON.stringify({ error: "KNOWLEDGE_CRON_SECRET is not configured" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    // allow overriding window in manual calls: ?hours=48
    const url = new URL(req.url);
    const hours = url.searchParams.get("hours");
    const maxUsers = url.searchParams.get("maxUsers");

    const res = await fetch(REFRESH_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${CRON_SECRET}`,
      },
      body: JSON.stringify({
        hours: hours ? Number(hours) : undefined,
        maxUsers: maxUsers ? Number(maxUsers) : undefined,
      }),
    });

    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") || "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Server error", details: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
});
