"use client";

import * as React from "react";
import {
  MessagesSquare,
  Send,
  Loader2,
  Bot,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { useShell } from "@/components/dashboard/shell";
import { createClient } from "@/lib/supabase/client";
import type { Conversation, Message } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "এইমাত্র";
  if (m < 60) return `${m} মিনিট আগে`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ঘণ্টা আগে`;
  return `${Math.floor(h / 24)} দিন আগে`;
}

export default function ConversationsPage() {
  const { activePageId } = useShell();
  const [listBundle, setListBundle] = React.useState<{
    pageId: string;
    items: Conversation[];
  } | null>(null);
  const [thread, setThread] = React.useState<{ id: string; items: Message[] } | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const loading = Boolean(activePageId) && listBundle?.pageId !== activePageId;
  const conversations = listBundle?.pageId === activePageId ? listBundle.items : [];
  const messages = thread?.id === selectedId ? thread.items : [];

  /* -------- load conversations + realtime -------- */
  React.useEffect(() => {
    if (!activePageId) return;

    const supabase = createClient();

    const load = async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("page_id", activePageId)
        .order("last_message_at", { ascending: false })
        .limit(100);
      if (!error) setListBundle({ pageId: activePageId, items: (data ?? []) as Conversation[] });
    };
    load();

    const channel = supabase
      .channel(`conversations:${activePageId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `page_id=eq.${activePageId}` },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activePageId]);

  /* -------- messages of the selected conversation -------- */
  React.useEffect(() => {
    if (!selectedId) return;

    const supabase = createClient();

    const load = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", selectedId)
        .order("created_at", { ascending: true })
        .limit(300);
      setThread({ id: selectedId, items: (data ?? []) as Message[] });
    };
    load();

    const channel = supabase
      .channel(`messages:${selectedId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${selectedId}` },
        (payload) => {
          setThread((prev) => {
            if (!prev || prev.id !== selectedId) return prev;
            const incoming = payload.new as Message;
            if (prev.items.some((m) => m.id === incoming.id)) return prev;
            return { ...prev, items: [...prev.items, incoming] };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedId]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, selectedId]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  async function sendReply() {
    if (!selected || !draft.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${selected.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || "send failed");

      setThread((prev) =>
        prev && prev.id === selected.id
          ? {
              ...prev,
              items: [
                ...prev.items,
                {
                  id: `local-${Date.now()}`,
                  page_id: selected.page_id,
                  conversation_id: selected.id,
                  psid: selected.psid,
                  role: "agent",
                  content: draft.trim(),
                  created_at: new Date().toISOString(),
                },
              ],
            }
          : prev
      );
      setDraft("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "পাঠানো যায়নি");
    } finally {
      setSending(false);
    }
  }

  async function togglePause(next: boolean) {
    if (!selected) return;
    try {
      const res = await fetch(`/api/conversations/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_paused: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "failed");
      setListBundle((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((c) =>
                c.id === selected.id ? { ...c, is_paused: next, state: next ? "paused" : "idle" } : c
              ),
            }
          : prev
      );
      toast.success(next ? "হিউমান টেকওভার চালু — বট বন্ধ" : "বট আবার চালু");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ব্যর্থ");
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">কথোপকথন / Conversations</h1>
          <p className="text-sm text-muted-foreground">
            লাইভ (Supabase Realtime) — বট বা নিজে উত্তর দিন
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500" /> Realtime চালু
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* List */}
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">কথোপকথন</p>
            <MessagesSquare className="size-4 text-muted-foreground" />
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> লোড হচ্ছে...
              </div>
            ) : conversations.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                এখনো কেউ মেসেজ করেনি। 💬
              </p>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    "flex w-full flex-col gap-1 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-muted",
                    selectedId === c.id && "bg-muted"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {c.customer_name || "অজানা ব্যবহারকারী"}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {timeAgo(c.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {c.is_paused ? (
                      <Badge className="bg-orange-500/15 text-orange-600">হিউমান</Badge>
                    ) : (
                      <Badge variant="secondary">বট</Badge>
                    )}
                    <span className="truncate text-xs text-muted-foreground">{c.state}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Thread */}
        <div className="flex min-h-[60vh] flex-col overflow-hidden rounded-xl border border-border">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
              <MessagesSquare className="size-10" />
              <p className="text-sm">বাঁ পাশ থেকে একটি কথোপকথন বাছাই করুন</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {selected.customer_name || "অজানা ব্যবহারকারী"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {selected.psid}
                    {selected.customer_name && (
                      <a
                        href={`tel:${selected.customer_name}`}
                        className="ml-2 inline-flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        <Phone className="size-3" /> কল
                      </a>
                    )}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <span className={cn(selected.is_paused ? "text-orange-600" : "text-muted-foreground")}>
                    হিউমান টেকওভার
                  </span>
                  <Switch
                    checked={selected.is_paused}
                    onCheckedChange={togglePause}
                  />
                </label>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto bg-muted/30 p-4">
                {messages.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    কোনো মেসেজ নেই।
                  </p>
                )}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn("flex", m.role === "customer" ? "justify-start" : "justify-end")}
                  >
                    <div
                      className={cn(
                        "max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                        m.role === "customer"
                          ? "rounded-bl-sm bg-background"
                          : m.role === "bot"
                            ? "rounded-br-sm bg-blue-600 text-white"
                            : "rounded-br-sm bg-emerald-600 text-white"
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                      <p
                        className={cn(
                          "mt-1 text-[10px]",
                          m.role === "customer" ? "text-muted-foreground" : "text-white/70"
                        )}
                      >
                        {m.role === "customer" ? "কাস্টমার" : m.role === "bot" ? "বট" : "আপনি"} •{" "}
                        {new Date(m.created_at).toLocaleTimeString("en-BD", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <div className="flex items-center gap-2 border-t border-border p-3">
                <Bot className="size-4 shrink-0 text-muted-foreground" />
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendReply();
                    }
                  }}
                  placeholder={
                    selected.is_paused
                      ? "মেসেজ লিখে পাঠান (হিউমান মোড)..."
                      : "মেসেজ লিখে পাঠান..."
                  }
                />
                <Button size="icon" onClick={sendReply} disabled={sending || !draft.trim()}>
                  {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </Button>
              </div>
              <p className="border-t border-border bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
                ℹ️ মেসেঞ্জারের ২৪ ঘণ্টার উইন্ডো বন্ধ হলে কাস্টমার আগে মেসেজ দিলেই আবার পাঠানো যাবে।
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
