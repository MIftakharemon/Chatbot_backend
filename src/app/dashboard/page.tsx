import Link from "next/link";
import {
  ShoppingCart,
  Banknote,
  AlertTriangle,
  Package,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { resolveActivePageId } from "@/lib/supabase/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { STATUS_LABELS } from "@/lib/labels";
import type { OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600",
  confirmed: "bg-blue-500/15 text-blue-600",
  shipped: "bg-violet-500/15 text-violet-600",
  delivered: "bg-emerald-500/15 text-emerald-600",
  cancelled: "bg-red-500/15 text-red-600",
};

export default async function OverviewPage() {
  const pageId = await resolveActivePageId();

  if (!pageId) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-2xl font-bold">স্বাগতম! 👋</h1>
        <p className="mt-3 text-muted-foreground">
          ড্যাশবোর্ড ব্যবহার করার জন্য আগে আপনার ফেসবুক পেজ কানেক্ট করুন।
        </p>
        <Button asChild className="mt-6">
          <Link href="/dashboard/pages">
            পেজ কানেক্ট করুন <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      </div>
    );
  }

  const supabase = await createClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [ordersRes, productsRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_number, customer_name, customer_phone, total, status, created_at")
      .eq("page_id", pageId)
      .gte("created_at", startOfDay.toISOString())
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("products")
      .select("id, name, stock, price, is_active")
      .eq("page_id", pageId)
      .order("stock", { ascending: true })
      .limit(100),
  ]);

  const todayOrders = (ordersRes.data ?? []) as any[];
  const products = (productsRes.data ?? []) as any[];

  const revenue = todayOrders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + Number(o.total ?? 0), 0);
  const pending = todayOrders.filter((o) => o.status === "pending").length;
  const lowStock = products.filter((p) => p.is_active && Number(p.stock) <= 5);

  const stats = [
    {
      label: "আজকের অর্ডার",
      en: "Orders today",
      value: String(todayOrders.length),
      icon: ShoppingCart,
      tone: "text-blue-600 bg-blue-500/10",
    },
    {
      label: "আজকের রেভিনিউ",
      en: "Revenue today",
      value: `৳${revenue.toLocaleString("en-BD")}`,
      icon: Banknote,
      tone: "text-emerald-600 bg-emerald-500/10",
    },
    {
      label: "পেন্ডিং অর্ডার",
      en: "Pending",
      value: String(pending),
      icon: Package,
      tone: "text-amber-600 bg-amber-500/10",
    },
    {
      label: "লো স্টক পণ্য",
      en: "Low stock",
      value: String(lowStock.length),
      icon: AlertTriangle,
      tone: "text-red-600 bg-red-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ওভারভিউ / Overview</h1>
        <p className="text-sm text-muted-foreground">আজকের ব্যবসার এক নজরে চিত্র</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${s.tone}`}>
                <s.icon className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold tracking-tight">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent orders */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>সাম্প্রতিক অর্ডার</CardTitle>
              <CardDescription>আজকের সর্বশেষ অর্ডারগুলো</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/orders">সব দেখুন</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {todayOrders.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                আজ এখনো কোনো অর্ডার আসেনি। 🕓
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>কাস্টমার</TableHead>
                    <TableHead>মোট</TableHead>
                    <TableHead>স্ট্যাটাস</TableHead>
                    <TableHead>সময়</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todayOrders.slice(0, 8).map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">#{o.order_number}</TableCell>
                      <TableCell>
                        <p className="truncate">{o.customer_name}</p>
                        <p className="text-xs text-muted-foreground">{o.customer_phone}</p>
                      </TableCell>
                      <TableCell>৳{Number(o.total).toLocaleString("en-BD")}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_TONE[o.status]}>
                          {STATUS_LABELS[o.status as OrderStatus] ?? o.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleTimeString("en-BD", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Low stock */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>লো স্টক</CardTitle>
              <CardDescription>৫ বা তার কম বাকি</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/products">পণ্য</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowStock.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                সব পণ্যের স্টক ঠিক আছে ✅
              </p>
            ) : (
              lowStock.slice(0, 8).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2"
                >
                  <span className="truncate text-sm">{p.name}</span>
                  <Badge className={p.stock === 0 ? "bg-red-500/15 text-red-600" : "bg-amber-500/15 text-amber-600"}>
                    {p.stock}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
