"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { Copy, Gift, Loader2, Share2 } from "lucide-react";

export function RewardsSection() {
  const supabase = useMemo(() => createClient(), []);
  const [myCode, setMyCode] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setMessage(null);
      const res = await fetch("/api/settings/referral/me");
      const json = await res.json();
      setMyCode(json.code || "");
      setLoading(false);
    };
    load();
  }, []);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("已复制");
    } catch {
      setMessage("复制失败");
    }
  };

  const onRedeem = async () => {
    if (!redeemCode.trim()) return;
    setRedeeming(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/referral/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: redeemCode.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "领取失败");
      setMessage(json.message || "领取成功");
      setRedeemCode("");
    } catch (e: any) {
      setMessage(e?.message ?? "领取失败");
    } finally {
      setRedeeming(false);
    }
  };

  const shareText = myCode
    ? `我在 NewsBox 用推荐码 ${myCode} 领取了会员，你也可以试试：输入该码可获赠 7 天会员（每人一次）。`
    : "";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-card rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-black/5 flex items-center justify-between">
          <h3 className="text-base font-bold text-card-foreground flex items-center gap-2">
            <Gift className="h-5 w-5" />
            会员奖励
          </h3>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#f5f5f7] rounded-2xl p-6">
            <div className="text-sm font-semibold text-card-foreground">输入推荐码，获赠会员</div>
            <div className="text-xs text-muted-foreground mt-1">
              输入收到的推荐码领取 7 天会员（每个账号最多领取 1 次）
            </div>
            <div className="mt-4 flex gap-2">
              <Input
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value)}
                placeholder="请输入推荐码"
                className="bg-card"
              />
              <Button onClick={onRedeem} disabled={redeeming || !redeemCode.trim()}>
                {redeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : "获取会员"}
              </Button>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-black/5 p-6">
            <div className="text-sm font-semibold text-card-foreground">邀请好友，获赠会员</div>
            <div className="text-xs text-muted-foreground mt-1">
              好友注册成功后填写你的推荐码，你和 TA 均可获得 7 天会员，最高 49 天
            </div>

            <div className="mt-4">
              <div className="text-xs text-muted-foreground">分享你的推荐码</div>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 bg-[#f5f5f7] rounded-xl px-4 py-3 font-mono text-sm text-card-foreground">
                  {loading ? "加载中…" : myCode || "—"}
                </div>
                <Button
                  variant="outline"
                  onClick={() => copyText(myCode)}
                  disabled={!myCode}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  复制
                </Button>
              </div>

              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => copyText(shareText)}
                  disabled={!myCode}
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  复制分享文案
                </Button>
              </div>
            </div>
          </div>
        </div>

        {message ? (
          <div className="px-6 pb-6 text-xs text-muted-foreground">{message}</div>
        ) : null}
      </div>
    </div>
  );
}


