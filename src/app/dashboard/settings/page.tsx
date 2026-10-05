"use client";

import * as React from "react";
import { Save, Loader2, Bot, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useShell } from "@/components/dashboard/shell";
import type { BotSettings } from "@/lib/types";
import { toast } from "sonner";

export default function SettingsPage() {
  const { activePageId } = useShell();
  const [bundle, setBundle] = React.useState<{
    pageId: string;
    settings: BotSettings | null;
  } | null>(null);
  const [settings, setSettings] = React.useState<BotSettings | null>(null);
  const [saving, setSaving] = React.useState(false);

  const loading = Boolean(activePageId) && bundle?.pageId !== activePageId;

  React.useEffect(() => {
    if (!activePageId) return;
    let stale = false;
    fetch("/api/settings")
      .then((r) => r.json())
      .then((json) => {
        if (stale) return;
        const incoming = json.settings ?? null;
        setBundle({ pageId: activePageId, settings: incoming });
        setSettings(incoming);
      })
      .catch(() => {
        if (!stale) toast.error("সেটিংস লোড ব্যর্থ");
      });
    return () => {
      stale = true;
    };
  }, [activePageId]);

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          payment_methods: Array.isArray(settings.payment_methods)
            ? settings.payment_methods
            : String(settings.payment_methods ?? "").split(","),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "save failed");
      setSettings(json.settings);
      toast.success("সেটিংস সেভ হয়েছে ✅");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "সেভ ব্যর্থ");
    } finally {
      setSaving(false);
    }
  }

  if (!activePageId) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          আগে ফেসবুক পেজ কানেক্ট করুন।
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> লোড হচ্ছে...
      </div>
    );
  }

  if (!settings) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          সেটিংস পাওয়া যায়নি — পেজ রিলোড করুন।
        </CardContent>
      </Card>
    );
  }

  const patch = (p: Partial<BotSettings>) => setSettings({ ...settings, ...p });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">বট সেটিংস / Bot settings</h1>
          <p className="text-sm text-muted-foreground">
            ওয়েলকাম মেসেজ, ডেলিভারি চার্জ ও কমেন্ট রিপ্লাই কাস্টমাইজ করুন
          </p>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
          সেভ করুন
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="size-4" /> বট চালু/বন্ধ
            </CardTitle>
            <CardDescription>মাস্টার সুইচ — বন্ধ থাকলে বট কোনো উত্তর দেবে না</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-3">
              <div>
                <p className="text-sm font-medium">বট সক্রিয় / Bot enabled</p>
                <p className="text-xs text-muted-foreground">কাস্টমার মেসেজে অটো রিপ্লাই</p>
              </div>
              <Switch
                checked={settings.bot_enabled}
                onCheckedChange={(v) => patch({ bot_enabled: v })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="welcome">ওয়েলকাম মেসেজ</Label>
              <Textarea
                id="welcome"
                rows={3}
                value={settings.welcome_message}
                onChange={(e) => patch({ welcome_message: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fallback">ফলব্যাক মেসেজ (অজানা ইনপুট)</Label>
              <Textarea
                id="fallback"
                rows={3}
                value={settings.fallback_message}
                onChange={(e) => patch({ fallback_message: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="size-4" /> ডেলিভারি ও পেমেন্ট
            </CardTitle>
            <CardDescription>অর্ডার কনফার্মেশনে এগুলো দেখানো হবে</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="d-in">ঢাকার ভিতরে ডেলিভারি (মিনিট)</Label>
                <Input
                  id="d-in"
                  type="number"
                  min={0}
                  value={settings.delivery_inside}
                  onChange={(e) => patch({ delivery_inside: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-out">ঢাকার বাইরে (মিনিট)</Label>
                <Input
                  id="d-out"
                  type="number"
                  min={0}
                  value={settings.delivery_outside}
                  onChange={(e) => patch({ delivery_outside: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay">পেমেন্ট মেথড (কমা দিয়ে)</Label>
              <Input
                id="pay"
                value={(settings.payment_methods ?? []).join(", ")}
                onChange={(e) =>
                  patch({
                    payment_methods: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  })
                }
                placeholder="ক্যাশ অন ডেলিভারি, বিকাশ"
              />
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              ℹ️ ডেলিভারি <strong>চার্জ</strong> হিসাব হয় ঠিকানার এলাকা ধরে — ঢাকার ভিতরে{" "}
              {settings.delivery_inside} মিনিট/চার্জ, বাইরে {settings.delivery_outside}।
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">কমেন্ট অটো-রিপ্লাই</CardTitle>
            <CardDescription>
              পোস্টে কমেন্ট করলে পাবলিক + প্রাইভেট (ইনবক্স) রিপ্লাই যাবে
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-3">
              <div>
                <p className="text-sm font-medium">অটো রিপ্লাই চালু / Auto reply</p>
                <p className="text-xs text-muted-foreground">ফিড কমেন্টে স্বয়ংক্রিয় উত্তর</p>
              </div>
              <Switch
                checked={settings.auto_comment_reply}
                onCheckedChange={(v) => patch({ auto_comment_reply: v })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="creply">রিপ্লাই টেক্সট</Label>
              <Textarea
                id="creply"
                rows={2}
                value={settings.comment_reply_text}
                onChange={(e) => patch({ comment_reply_text: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
          সেভ করুন
        </Button>
      </div>
    </div>
  );
}
