"use client";

import * as React from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Upload,
  Loader2,
  PackageSearch,
  FileDown,
  ImagePlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { money } from "@/lib/labels";
import type { Product } from "@/lib/types";
import { toast } from "sonner";

interface FormState {
  id?: string;
  name: string;
  description: string;
  price: string;
  stock: string;
  sizes: string;
  colors: string;
  sku: string;
  image_url: string;
  is_active: boolean;
}

const EMPTY: FormState = {
  name: "",
  description: "",
  price: "",
  stock: "0",
  sizes: "",
  colors: "",
  sku: "",
  image_url: "",
  is_active: true,
};

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let field = ""
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ",") {
      row.push(field)
      field = ""
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++
      row.push(field)
      if (row.some((c) => c.trim() !== "")) rows.push(row)
      row = []
      field = ""
    } else {
      field += ch
    }
  }
  row.push(field)
  if (row.some((c) => c.trim() !== "")) rows.push(row)

  if (rows.length < 2) return []
  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"))
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => (obj[h] = (r[i] ?? "").trim()))
    return obj
  })
}

export default function ProductsPage() {
  const { activePageId } = useShell();
  const [bundle, setBundle] = React.useState<{ pageId: string; items: Product[] } | null>(null);
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [importing, setImporting] = React.useState(false);

  const loading = Boolean(activePageId) && bundle?.pageId !== activePageId;
  const products = bundle?.pageId === activePageId ? bundle.items : [];

  const fetchProducts = React.useCallback(async (pageId: string): Promise<Product[]> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("page_id", pageId)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      return [];
    }
    return (data ?? []) as Product[];
  }, []);

  // used by handlers (after create/save/delete) to force a reload
  const load = React.useCallback(async () => {
    if (!activePageId) return;
    const items = await fetchProducts(activePageId);
    setBundle({ pageId: activePageId, items });
  }, [activePageId, fetchProducts]);

  React.useEffect(() => {
    if (!activePageId) return;
    fetchProducts(activePageId).then((items) => setBundle({ pageId: activePageId, items }));
  }, [activePageId, fetchProducts]);

  function openCreate() {
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(p: Product) {
    setForm({
      id: p.id,
      name: p.name,
      description: p.description ?? "",
      price: String(p.price),
      stock: String(p.stock),
      sizes: (p.sizes ?? []).join(", "),
      colors: (p.colors ?? []).join(", "),
      sku: p.sku ?? "",
      image_url: p.image_url ?? "",
      is_active: p.is_active,
    });
    setOpen(true);
  }

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "upload failed");
      setForm((f) => ({ ...f, image_url: json.url }));
      toast.success("ছবি আপলোড হয়েছে");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "আপলোড ব্যর্থ");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!form.name.trim()) return toast.error("পণ্যের নাম দিন");
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: Number(form.price || 0),
      stock: Number(form.stock || 0),
      sizes: form.sizes,
      colors: form.colors,
      sku: form.sku.trim() || null,
      image_url: form.image_url || null,
      is_active: form.is_active,
    };

    try {
      const res = await fetch(form.id ? `/api/products/${form.id}` : "/api/products", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "save failed");
      toast.success(form.id ? "আপডেট হয়েছে ✅" : "পণ্য যোগ হয়েছে ✅");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "সেভ ব্যর্থ");
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: Product) {
    if (!confirm(`"${p.name}" মুছে ফেলবেন?`)) return;
    try {
      const res = await fetch(`/api/products/${p.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "delete failed");
      toast.success("মুছে ফেলা হয়েছে");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ব্যর্থ");
    }
  }

  async function importCsv(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) throw new Error("CSV খালি বা ফরম্যাট সঠিক নয়");

      const items = rows.map((r) => ({
        name: r.name || r.product || r["পণ্যের নাম"],
        price: Number(r.price || r["দাম"] || 0),
        stock: Number(r.stock || r["স্টক"] || 0),
        description: r.description || r.brief || null,
        sizes: r.sizes || r.size || "",
        colors: r.colors || r.color || "",
        sku: r.sku || null,
        image_url: r.image_url || r.image || null,
      }));

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "import failed");
      toast.success(`${json.products?.length ?? items.length}টি পণ্য ইমপোর্ট হয়েছে ✅`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ইমপোর্ট ব্যর্থ");
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const csv =
      "name,price,stock,sizes,colors,description,sku,image_url\n" +
      '"Panjabi Cotton",1200,24,"S,M,L","White,Blue",Cotton panjabi,PJ-001,\n'
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "products-template.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">পণ্য / Products</h1>
          <p className="text-sm text-muted-foreground">
            দাম, সাইজ, স্টক ও ছবি ম্যানেজ করুন — বট এগুলোই কাস্টমারকে দেখাবে
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <FileDown className="mr-2 size-4" /> CSV টেমপ্লেট
          </Button>
          <label className="inline-flex">
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importCsv(f);
                e.target.value = "";
              }}
            />
            <span className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm font-medium hover:bg-muted">
              {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              CSV ইমপোর্ট
            </span>
          </label>
          <Button size="sm" onClick={openCreate} disabled={!activePageId}>
            <Plus className="mr-2 size-4" /> নতুন পণ্য
          </Button>
        </div>
      </div>

      {!activePageId ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            আগে একটি ফেসবুক পেজ কানেক্ট করুন।
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> লোড হচ্ছে...
        </div>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <PackageSearch className="size-10 text-muted-foreground" />
            <p className="font-medium">কোনো পণ্য নেই</p>
            <p className="text-sm text-muted-foreground">
              “নতুন পণ্য” বাটনে চাপ দিন অথবা CSV আপলোড করুন।
            </p>
            <Button onClick={openCreate}>
              <Plus className="mr-2 size-4" /> পণ্য যোগ করুন
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>পণ্য</TableHead>
                <TableHead>দাম</TableHead>
                <TableHead>সাইজ</TableHead>
                <TableHead>স্টক</TableHead>
                <TableHead>স্ট্যাটাস</TableHead>
                <TableHead className="text-right">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                        {p.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.image_url} alt={p.name} className="size-10 object-cover" />
                        ) : (
                          <PackageSearch className="size-4 text-muted-foreground" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.sku || p.description || "—"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{money(p.price)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {(p.sizes ?? []).join(", ") || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        p.stock === 0
                          ? "bg-red-500/15 text-red-600"
                          : p.stock <= 5
                            ? "bg-amber-500/15 text-amber-600"
                            : "bg-emerald-500/15 text-emerald-700"
                      }
                    >
                      {p.stock}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.is_active ? "default" : "secondary"}>
                      {p.is_active ? "সক্রিয়" : "নিষ্ক্রিয়"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)} title="Edit">
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => remove(p)}
                        title="Delete"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add / edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "পণ্য সম্পাদনা" : "নতুন পণ্য যোগ করুন"}</DialogTitle>
            <DialogDescription>সব তথ্য বট কাস্টমারকে দেখাবে</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="p-name">পণ্যের নাম *</Label>
              <Input
                id="p-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="যেমন: Panjabi Cotton"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="p-desc">বিবরণ / Description</Label>
              <Textarea
                id="p-desc"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="p-price">দাম (৳) *</Label>
                <Input
                  id="p-price"
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-stock">স্টক *</Label>
                <Input
                  id="p-stock"
                  type="number"
                  min={0}
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="p-sizes">সাইজ (কমা দিয়ে)</Label>
                <Input
                  id="p-sizes"
                  value={form.sizes}
                  onChange={(e) => setForm({ ...form, sizes: e.target.value })}
                  placeholder="S, M, L"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-colors">রঙ (কমা দিয়ে)</Label>
                <Input
                  id="p-colors"
                  value={form.colors}
                  onChange={(e) => setForm({ ...form, colors: e.target.value })}
                  placeholder="White, Blue"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="p-sku">SKU (ঐচ্ছিক)</Label>
              <Input
                id="p-sku"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>ছবি / Image</Label>
              <div className="flex items-center gap-3">
                <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                  {form.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.image_url} alt="product" className="size-16 object-cover" />
                  ) : (
                    <ImagePlus className="size-5 text-muted-foreground" />
                  )}
                </span>
                <label className="inline-flex">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadImage(f);
                      e.target.value = "";
                    }}
                  />
                  <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm font-medium hover:bg-muted">
                    {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                    ছবি আপলোড
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">সক্রিয় / Active</p>
                <p className="text-xs text-muted-foreground">বন্ধ থাকলে বট এটা দেখাবে না</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              বাতিল
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              সেভ করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
