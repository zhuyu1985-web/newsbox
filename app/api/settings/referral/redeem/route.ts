import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GRANT_DAYS = 7;
const INVITE_CAP_DAYS = 49;

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

async function grantMembershipDays(supabase: any, userId: string, days: number) {
  const now = new Date();
  const { data: row } = await supabase
    .from("user_memberships")
    .select("user_id, expires_at, invite_rewarded_days")
    .eq("user_id", userId)
    .maybeSingle();

  const currentExpires = row?.expires_at ? new Date(row.expires_at) : null;
  const base = currentExpires && currentExpires > now ? currentExpires : now;
  const nextExpires = addDays(base, days);

  if (!row) {
    const { error } = await supabase.from("user_memberships").insert({
      user_id: userId,
      expires_at: nextExpires.toISOString(),
      invite_rewarded_days: 0,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("user_memberships")
      .update({ expires_at: nextExpires.toISOString(), updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) throw error;
  }
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const normalized = (code ?? "").trim().toUpperCase();
  if (!normalized) {
    return NextResponse.json({ error: "推荐码不能为空" }, { status: 400 });
  }

  // lookup inviter
  const { data: inviter, error: inviterErr } = await supabase
    .from("user_referral_codes")
    .select("user_id, code")
    .eq("code", normalized)
    .maybeSingle();

  if (inviterErr || !inviter) {
    return NextResponse.json({ error: "推荐码无效" }, { status: 400 });
  }

  if (inviter.user_id === user.id) {
    return NextResponse.json({ error: "不能使用自己的推荐码" }, { status: 400 });
  }

  // ensure redeemer has not redeemed before
  const { data: existing } = await supabase
    .from("referral_redemptions")
    .select("id")
    .eq("redeemer_user_id", user.id)
    .maybeSingle();

  if (existing?.id) {
    return NextResponse.json({ error: "你已领取过推荐码奖励（每账号仅一次）" }, { status: 400 });
  }

  // inviter cap check
  const { data: inviterMembership } = await supabase
    .from("user_memberships")
    .select("invite_rewarded_days")
    .eq("user_id", inviter.user_id)
    .maybeSingle();

  const already = inviterMembership?.invite_rewarded_days ?? 0;
  const remaining = Math.max(0, INVITE_CAP_DAYS - already);
  const inviterGrant = Math.min(GRANT_DAYS, remaining);

  try {
    // grant redeemer always
    await grantMembershipDays(supabase, user.id, GRANT_DAYS);

    // grant inviter if not capped
    if (inviterGrant > 0) {
      await grantMembershipDays(supabase, inviter.user_id, inviterGrant);
      await supabase
        .from("user_memberships")
        .update({
          invite_rewarded_days: already + inviterGrant,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", inviter.user_id);
    }

    // record redemption (unique constraint prevents double redemption)
    const { error: insErr } = await supabase.from("referral_redemptions").insert({
      redeemer_user_id: user.id,
      inviter_user_id: inviter.user_id,
      code: normalized,
      days_granted: GRANT_DAYS,
    });
    if (insErr) throw insErr;

    const message =
      inviterGrant > 0
        ? `领取成功：你获得 ${GRANT_DAYS} 天会员，邀请人获得 ${inviterGrant} 天（累计上限 ${INVITE_CAP_DAYS} 天）`
        : `领取成功：你获得 ${GRANT_DAYS} 天会员（邀请人已达奖励上限）`;

    return NextResponse.json({ message });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "领取失败" }, { status: 500 });
  }
}


