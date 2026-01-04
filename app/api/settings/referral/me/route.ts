import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function generateCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { data: existing } = await supabase
    .from("user_referral_codes")
    .select("code")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.code) {
    return NextResponse.json({ code: existing.code });
  }

  // create a unique code (best-effort)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { error } = await supabase.from("user_referral_codes").insert({
      user_id: user.id,
      code,
    });
    if (!error) {
      return NextResponse.json({ code });
    }
  }

  return NextResponse.json({ error: "生成推荐码失败" }, { status: 500 });
}


