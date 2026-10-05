"use client";

import * as React from "react";
import { Phone, Search, Loader2, ClipboardList, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { useShell } from "@/components/dashboard/shell";
import { createClient } from "@/lib/supabase/client";
import { STATUS_LABELS, STATUS_OPTIONS, formatDateTime, money } from "@/lib/labels";
import type { Order, OrderStatus } from "@/lib/types";
import { toast } from "sonner";

const STATUS_TONE: Record<OrderStatus, string> = {
  pending: "bg-amber-500/15 text-amber-600",
  confirmed: "bg-blue-500/15 text-blue-600",
  shipped: "bg-violet-500/15 text-violet-600",
  delivered: "bg-emerald-500/15 text-emerald-600",
  cancelled: "bg-red-500/15 text-red-600",
};

export default function OrdersPage() {
  const { activePageId } = useShell();
  const [bundle, setBundle] = React.useState<{
    pageId: string;
    status: string;
    items: Order[];
  } | null>(null);
  const [status, setStatus] = React.useState<string>("all");
  const [q, setQ] = React.useState("");
  const [selected, setSelected] = React.useState<Order | null>(null);
  const [updating, setUpdating] = React.useState<string | null>(null);

  const loading =
    Boolean(activePageId) && (bundle?.pageId !== activePageId || bundle?.status !== status);
  const orders = React.useMemo(
    () => (bundle?.pageId === activePageId && bundle.status === status ? bundle.items : []),
    [bundle, activePageId, status]
  );

  const fetchOrders = React.useCallback(
    async (pageId: string, statusFilter: string): Promise<Order[]> => {
      const supabase = createClient();
      let query = supabase
        .from("orders")
        .select("*")
        .eq("page_id", pageId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) {
        toast.error(error.message);
        return [];
      }
      return (data ?? []) as Order[];
    },
    []
  );

  // used by the refresh button
  const load = React.useCallback(async () => {
    if (!activePageId) return;
    const items = await fetchOrders(activePageId, status);
    setBundle({ pageId: activePageId, status, items });
  }, [activePageId, status, fetchOrders]);

  React.useEffect(() => {
    if (!activePageId) return;
    fetchOrders(activePageId, status).then((items) =>
      setBundle({ pageId: activePageId, status, items })
    );
  }, [activePageId, status, fetchOrders]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return orders;
    return orders.filter(
      (o) =>
        o.customer_name.toLowerCase().includes(needle) ||
        o.customer_phone.includes(needle) ||
        String(o.order_number).includes(needle)
    );
  }, [orders, q]);

  async function updateStatus(order: Order, next: OrderStatus) {
    setUpdating(order.id);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "update failed");
      setBundle((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((o) => (o.id === order.id ? { ...o, status: next } : o)),
            }
          : prev
      );
      setSelected((prev) => (prev?.id === order.id ? { ...prev, status: next } : prev));
      toast.success(`স্ট্যাটাস: ${STATUS_LABELS[next]}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "আপডেট ব্যর্থ");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">অর্ডার / Orders</h1>
          <p className="text-sm text-muted-foreground">
            অর্ডার দেখুন, স্ট্যাটাস আপডেট করুন, কাস্টমারকে কল করুন
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="নাম / ফোন / অর্ডার নম্বর"
              className="w-56 pl-8"
            />
          </div>
          <Button variant="outline" size="icon" onClick={load} title="রিফ্রেশ">
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>

      <Tabs value={status} onValueChange={setStatus}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="all">সব</TabsTrigger>
          {STATUS_OPTIONS.map((s) => (
            <TabsTrigger key={s.value} value={s.value}>
              {STATUS_LABELS[s.value]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {!activePageId ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            আগে ফেসবুক পেজ কানেক্ট করুন।
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> লোড হচ্ছে...
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <ClipboardList className="size-10 text-muted-foreground" />
            <p className="font-medium">কোনো অর্ডার পাওয়া যায়নি</p>
            <p className="text-sm text-muted-foreground">
              কাস্টমার বটের সাথে কথা বললে অর্ডার এখানে আসবে।
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>অর্ডার</TableHead>
                <TableHead>কাস্টমার</TableHead>
                <TableHead>ফোন</TableHead>
                <TableHead>মোট</TableHead>
                <TableHead>স্ট্যাটাস</TableHead>
                <TableHead>সময়</TableHead>
                <TableHead className="text-right">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => (
                <TableRow key={o.id} className="cursor-pointer" onClick={() => setSelected(o)}>
                  <TableCell className="font-medium">#{o.order_number}</TableCell>
                  <TableCell className="max-w-[160px] truncate">{o.customer_name}</TableCell>
                  <TableCell>
                    <a
                      href={`tel:${o.customer_phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                    >
                      <Phone className="size-3.5" /> {o.customer_phone}
                    </a>
                  </TableCell>
                  <TableCell className="font-medium">{money(o.total)}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_TONE[o.status]}>{STATUS_LABELS[o.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(o.created_at)}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <select
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      value={o.status}
                      disabled={updating === o.id}
                      onChange={(e) => updateStatus(o, e.target.value as OrderStatus)}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Order detail */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-md">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>অর্ডার #{selected.order_number}</DialogTitle>
                <DialogDescription>{formatDateTime(selected.created_at)}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                <div className="rounded-lg border border-border p-3">
                  <p className="font-medium">{selected.customer_name}</p>
                  <a
                    href={`tel:${selected.customer_phone}`}
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    <Phone className="size-3.5" /> {selected.customer_phone}
                  </a>
                  <p className="mt-1 text-muted-foreground">{selected.customer_address}</p>
                </div>

                <div className="space-y-2">
                  {(selected.items ?? []).map((item, i) => (
                    <div key={i} className="flex items-center justify-between gap-3">
                      <span className="truncate">
                        {item.name}
                        {item.size ? ` (${item.size})` : ""} × {item.qty}
                      </span>
                      <span className="shrink-0">{money(item.price * item.qty)}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1 border-t border-border pt-3">
                  <div className="flex justify-between text-muted-foreground">
                    <span>সাবটোটাল</span>
                    <span>{money(selected.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>ডেলিভারি</span>
                    <span>{money(selected.delivery_charge)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>মোট</span>
                    <span>{money(selected.total)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">স্ট্যাটাস:</span>
                  <select
                    className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                    value={selected.status}
                    disabled={updating === selected.id}
                    onChange={(e) => updateStatus(selected, e.target.value as OrderStatus)}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
