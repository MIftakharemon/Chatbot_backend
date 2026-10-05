import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/shell";
import type { PublicPage } from "@/lib/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase
    .from("pages")
    .select("id, fb_page_id, page_name, page_avatar_url, is_active, connected_at, token_expires_at")
    .order("connected_at", { ascending: true });

  const pages = (data ?? []) as PublicPage[];

  const cookieStore = await cookies();
  const cookiePageId = cookieStore.get("active_page_id")?.value ?? null;
  const activePageId =
    cookiePageId && pages.some((p) => p.id === cookiePageId)
      ? cookiePageId
      : pages[0]?.id ?? null;

  return (
    <DashboardShell pages={pages} activePageId={activePageId}>
      {children}
    </DashboardShell>
  );
}
