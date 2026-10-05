"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Globe as Facebook,
  Plus,
  Trash2,
  Power,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useShell } from "@/components/dashboard/shell";
import { toast } from "sonner";

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: "আপনি Facebook অনুমতি বাতিল করেছেন।",
  invalid_state: "সেশন মেয়াদোত্তীর্ণ — আবার চেষ্টা করুন।",
  no_pages: "আপনার অ্যাকাউন্টে কোনো পেজ পাওয়া যায়নি।",
  exchange_failed: "টোকেন এক্সচেঞ্জ ব্যর্থ হয়েছে — আবার চেষ্টা করুন।",
};

function PagePicker({ items }: { items: { id: string; name: string; category?: string }[] }) {
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const router = useRouter();

  async function connect(item: { id: string; name: string }) {
    setBusyId(item.id);
    try {
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fb_page_id: item.id, page_name: item.name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "connection failed");
      toast.success(`${item.name} কানেক্ট হয়েছে ✅`);
      router.push("/dashboard/pages");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "কানেকশন ব্যর্থ");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">কোন পেজ যুক্ত করবেন?</h1>
        <p className="text-sm text-muted-foreground">
          আপনার Facebook অ্যাকাউন্টে পাওয়া যাচ্ছে এমন পেজগুলো থেকে বেছে নিন।
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{item.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.category || item.id}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => connect(item)}
                disabled={busyId === item.id}
              >
                {busyId === item.id ? <Loader2 className="size-4 animate-spin" /> : "যুক্ত করুন"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <Button variant="outline" asChild>
        <Link href="/dashboard/pages">← ফিরে যান</Link>
      </Button>
    </div>
  );
}

function PagesContent() {
  const { pages, activePageId, setActivePage } = useShell();
  const params = useSearchParams();
  const router = useRouter();

  const choose = params.get("choose") === "1";
  const connectedFlag = params.get("connected") === "1";
  const errorFlag = params.get("error");

  const [available, setAvailable] = React.useState<
    { id: string; name: string; category?: string }[] | null
  >(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!choose) return;
    let stale = false;
    fetch("/api/pages")
      .then((r) => r.json())
      .then((json) => {
        if (stale) return;
        if (json.error) toast.error(json.error);
        setAvailable(json.available ?? []);
      })
      .catch(() => {
        if (!stale) {
          toast.error("পেজ লোড ব্যর্থ");
          setAvailable([]);
        }
      });
    return () => {
      stale = true;
    };
  }, [choose]);

  React.useEffect(() => {
    if (connectedFlag) toast.success("পেজ সফলভাবে কানেক্ট হয়েছে ✅");
    if (errorFlag) toast.error(ERROR_MESSAGES[errorFlag] ?? "কানেকশন ব্যর্থ হয়েছে");
  }, [connectedFlag, errorFlag]);

  async function disconnect(id: string, name: string) {
    if (!confirm(`"${name}" ডিসকানেক্ট করবেন? বট বন্ধ হয়ে যাবে।`)) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/pages/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "failed");
      toast.success("ডিসকানেক্ট হয়েছে");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ব্যর্থ");
    } finally {
      setBusy(null);
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    setBusy(id);
    try {
      const res = await fetch(`/api/pages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !isActive, make_active: id === activePageId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "failed");
      toast.success(!isActive ? "বট চালু হয়েছে" : "বট বন্ধ হয়েছে");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ব্যর্থ");
    } finally {
      setBusy(null);
    }
  }

  if (choose) {
    if (available === null) {
      return (
        <div className="flex items-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> পেজ লোড হচ্ছে...
        </div>
      );
    }
    return <PagePicker items={available} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">পেজসমূহ / Pages</h1>
          <p className="text-sm text-muted-foreground">
            ফেসবুক পেজ কানেক্ট করুন এবং বট চালু/বন্ধ করুন
          </p>
        </div>
        <Button asChild>
          <a href="/api/connect">
            <Plus className="mr-2 size-4" /> নতুন পেজ কানেক্ট করুন
          </a>
        </Button>
      </div>

      {pages.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
              <Facebook className="size-7" />
            </span>
            <div>
              <p className="font-semibold">এখনো কোনো পেজ কানেক্ট করা হয়নি</p>
              <p className="text-sm text-muted-foreground">
                Facebook Login দিয়ে আপনার ই-কমার্স পেজ যুক্ত করুন — ২ মিনিট লাগবে।
              </p>
            </div>
            <Button asChild>
              <a href="/api/connect">
                <Facebook className="mr-2 size-4" /> Facebook দিয়ে কানেক্ট করুন
              </a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {pages.map((page) => (
            <Card key={page.id} className={page.id === activePageId ? "border-primary" : undefined}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center overflow-hidden rounded-xl bg-blue-500/10">
                    {page.page_avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={page.page_avatar_url}
                        alt={page.page_name}
                        className="size-11 rounded-xl object-cover"
                      />
                    ) : (
                      <Facebook className="size-5 text-blue-600" />
                    )}
                  </span>
                  <div>
                    <CardTitle className="text-base">{page.page_name}</CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      {page.fb_page_id}
                      <ExternalLink className="size-3" />
                    </CardDescription>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={page.is_active ? "default" : "secondary"}>
                    {page.is_active ? "বট চালু" : "বট বন্ধ"}
                  </Badge>
                  {page.id === activePageId && <Badge variant="outline">সক্রিয়</Badge>}
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActivePage(page.id)}
                  disabled={page.id === activePageId}
                >
                  {page.id === activePageId ? "সক্রিয় পেজ" : "অ্যাক্টিভ করুন"}
                </Button>
                <Button
                  size="sm"
                  variant={page.is_active ? "secondary" : "default"}
                  onClick={() => toggleActive(page.id, page.is_active)}
                  disabled={busy === page.id}
                >
                  <Power className="mr-1.5 size-4" />
                  {page.is_active ? "বট বন্ধ" : "বট চালু"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => disconnect(page.id, page.page_name)}
                  disabled={busy === page.id}
                >
                  <Trash2 className="mr-1.5 size-4" /> ডিসকানেক্ট
                </Button>
                <span className="w-full text-xs text-muted-foreground">
                  কানেক্ট: {new Date(page.connected_at).toLocaleDateString("en-BD")}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        <p className="text-muted-foreground">
          কানেক্ট করলেই আপনার পেজ আমাদের webhook-এ সাবস্ক্রাইব হয়ে যাবে
          (messages, postbacks, feed) — কোনো কোড লিখতে হবে না। টোকেন কখনো ব্রাউজারে
          দেখানো হয় না।
        </p>
      </div>
      {errorFlag && !ERROR_MESSAGES[errorFlag] && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <XCircle className="size-4 text-destructive" /> {errorFlag}
        </div>
      )}
    </div>
  );
}

export default function PagesPage() {
  return (
    <React.Suspense fallback={<div className="py-16 text-muted-foreground">লোড হচ্ছে...</div>}>
      <PagesContent />
    </React.Suspense>
  );
}
