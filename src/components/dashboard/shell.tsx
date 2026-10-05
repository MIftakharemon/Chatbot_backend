"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Globe as Facebook,
  Package,
  ShoppingCart,
  MessagesSquare,
  Settings,
  LogOut,
  MessageCircle,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { PublicPage } from "@/lib/types";

const NAV = [
  { href: "/dashboard", label: "ওভারভিউ", en: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/pages", label: "পেজসমূহ", en: "Pages", icon: Facebook },
  { href: "/dashboard/products", label: "পণ্য", en: "Products", icon: Package },
  { href: "/dashboard/orders", label: "অর্ডার", en: "Orders", icon: ShoppingCart },
  { href: "/dashboard/conversations", label: "কথোপকথন", en: "Conversations", icon: MessagesSquare },
  { href: "/dashboard/settings", label: "সেটিংস", en: "Settings", icon: Settings },
];

interface ShellContextValue {
  pages: PublicPage[];
  activePageId: string | null;
  setActivePage: (id: string) => void;
}

export const ShellContext = React.createContext<ShellContextValue>({
  pages: [],
  activePageId: null,
  setActivePage: () => {},
});

export const useShell = () => React.useContext(ShellContext);

export function DashboardShell({
  pages,
  activePageId,
  children,
}: {
  pages: PublicPage[];
  activePageId: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function setActivePage(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/pages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ make_active: true }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "failed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "পেজ পরিবর্তন ব্যর্থ");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const activePage = pages.find((p) => p.id === activePageId) ?? pages[0] ?? null;

  return (
    <ShellContext.Provider value={{ pages, activePageId, setActivePage }}>
      <div className="flex min-h-screen w-full">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
          <div className="flex h-16 items-center gap-2 border-b border-border px-5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MessageCircle className="size-4" />
            </span>
            <span className="text-lg font-semibold tracking-tight">PageBot</span>
          </div>

          <nav className="flex flex-1 flex-col gap-1 p-3">
            {NAV.map((item) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span className="flex flex-col leading-tight">
                    <span>{item.label}</span>
                    <span className="text-[10px] opacity-70">{item.en}</span>
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-border p-3">
            <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
              <LogOut className="mr-2 size-4" /> লগআউট / Logout
            </Button>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
            {/* Active page switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="max-w-[240px] gap-2" disabled={busy}>
                  <Facebook className="size-4 text-blue-600" />
                  <span className="truncate">
                    {activePage ? activePage.page_name : "পেজ কানেক্ট করুন"}
                  </span>
                  <ChevronsUpDown className="size-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>সক্রিয় পেজ / Active page</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {pages.length === 0 && (
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/pages">+ পেজ কানেক্ট করুন</Link>
                  </DropdownMenuItem>
                )}
                {pages.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => p.id !== activePage?.id && setActivePage(p.id)}
                  >
                    <span className="truncate">{p.page_name}</span>
                    {p.id === activePage?.id && <Check className="ml-auto size-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile nav */}
            <nav className="flex min-w-0 flex-1 items-center justify-end gap-1 overflow-x-auto lg:hidden">
              {NAV.map((item) => {
                const active =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
                      active ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    )}
                    title={item.en}
                  >
                    <item.icon className="size-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                );
              })}
              <Button variant="ghost" size="icon" onClick={signOut} title="লগআউট">
                <LogOut className="size-4" />
              </Button>
            </nav>

            <div className="hidden items-center gap-2 lg:flex">
              <span className="text-xs text-muted-foreground">
                {activePage ? `fb.com/${activePage.fb_page_id}` : "no page connected"}
              </span>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </ShellContext.Provider>
  );
}
