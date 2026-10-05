"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 8) {
      toast.error("পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    setNeedsConfirm(true);
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <span className="mx-auto mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <MessageCircle className="size-5" />
          </span>
          <CardTitle className="text-2xl">সাইন আপ / Sign up</CardTitle>
          <CardDescription>ফ্রি অ্যাকাউন্ট তৈরি করে পেজ কানেক্ট করুন</CardDescription>
        </CardHeader>
        <CardContent>
          {needsConfirm ? (
            <div className="space-y-4 text-center">
              <p className="rounded-md bg-muted px-4 py-3 text-sm">
                ✅ কনফার্মেশন লিংক <span className="font-medium">{email}</span> ঠিকানায়
                পাঠানো হয়েছে। লিংকে ক্লিক করে লগইন করুন।
              </p>
              <Button variant="outline" asChild className="w-full">
                <Link href="/login">লগইন পেজে যান</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">পুরো নাম / Full name</Label>
                <Input
                  id="name"
                  required
                  placeholder="আপনার নাম"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">ইমেইল / Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">পাসওয়ার্ড / Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="কমপক্ষে ৮ অক্ষর"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                অ্যাকাউন্ট তৈরি করুন
              </Button>
            </form>
          )}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            অ্যাকাউন্ট আছে?{" "}
            <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
              লগইন করুন
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
