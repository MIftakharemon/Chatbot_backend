import Link from "next/link";
import {
  MessageCircle,
  ShoppingBag,
  Users,
  MessageSquare,
  Zap,
  Shield,
  ArrowRight,
  Check,
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

const FEATURES = [
  {
    icon: MessageCircle,
    title: "অটোমেটিক অর্ডার টেকিং",
    en: "Automated order taking",
    description:
      "নাম → ফোন → ঠিকানা → কনফার্ম। কাস্টমারের সাথে কথা বলে বট নিজেই অর্ডার তৈরি করে।",
  },
  {
    icon: ShoppingBag,
    title: "পণ্য ব্রাউজিং",
    en: "Product browsing",
    description:
      "আপনার আপলোড করা পণ্য, দাম, সাইজ ও স্টক মেসেঞ্জারে কার্ড আকারে দেখায়।",
  },
  {
    icon: MessageSquare,
    title: "কমেন্ট অটো-রিপ্লাই",
    en: "Comment auto-reply",
    description:
      "পোস্টের কমেন্টে পাবলিক + প্রাইভেট রিপ্লাই — ২৪/৭, একই সেকেন্ডে।",
  },
  {
    icon: Users,
    title: "হিউমান টেকওভার",
    en: "Human takeover",
    description:
      "“মানুষ” লিখলেই বট থামে — ড্যাশবোর্ড থেকে লাইভ কথা বলুন, রিয়েলটাইমে।",
  },
  {
    icon: Zap,
    title: "স্টক ও ডেলিভারি",
    en: "Stock & delivery",
    description:
      "স্টক অটো-ডিক্রিমেন্ট, এলাকাভিত্তিক ডেলিভারি চার্জ ও পেমেন্ট মেথড।",
  },
  {
    icon: Shield,
    title: "মাল্টি-টেন্যান্ট",
    en: "Multi-tenant & secure",
    description:
      "প্রতিটি পেজের ডেটা আলাদা — Supabase RLS দিয়ে সম্পূর্ণ আইসোলেশন।",
  },
];

const STEPS = [
  { n: "০১", title: "পেজ কানেক্ট করুন", en: "Connect your page", desc: "Facebook OAuth দিয়ে এক ক্লিকে আপনার পেজ যুক্ত হবে।" },
  { n: "০২", title: "পণ্য আপলোড করুন", en: "Upload products", desc: "CSV ইমপোর্ট বা ম্যানুয়াল — নাম, দাম, সাইজ, স্টক।" },
  { n: "০৩", title: "বট চালু করুন", en: "Turn the bot on", desc: "ওয়েলকাম মেসেজ ও সেটিংস কাস্টমাইজ করে পাবলিশ।" },
  { n: "০৪", title: "অর্ডার পান", en: "Get orders", desc: "ড্যাশবোর্ডে অর্ডার, কাস্টমার ও কথোপকথন দেখুন।" },
];

const PRICING = [
  {
    name: "Starter",
    price: "৳0",
    period: "/ মাস",
    tagline: "শুরু করার জন্য",
    features: ["১টি পেজ", "৫০টি পণ্য", "অটো অর্ডার টেকিং", "কমেন্ট রিপ্লাই"],
    cta: "ফ্রি শুরু করুন",
    highlight: false,
  },
  {
    name: "Pro",
    price: "৳1,499",
    period: "/ মাস",
    tagline: "ব্যবসার জন্য",
    features: [
      "৫টি পেজ",
      "আনলিমিটেড পণ্য",
      "লাইভ কনভারসেশন + টেকওভার",
      "CSV ইমপোর্ট",
      "প্রায়োরিটি সাপোর্ট",
    ],
    cta: "Pro নিন",
    highlight: true,
  },
  {
    name: "Business",
    price: "৳4,999",
    period: "/ মাস",
    tagline: "স্কেল করার জন্য",
    features: ["আনলিমিটেড পেজ", "কাস্টম বট ফ্লো", "API অ্যাক্সেস", "ডেডিকেটেড সাপোর্ট"],
    cta: "যোগাযোগ করুন",
    highlight: false,
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MessageCircle className="size-4" />
            </span>
            <span className="text-lg font-semibold tracking-tight">PageBot</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">ফিচার</a>
            <a href="#how" className="hover:text-foreground">কীভাবে কাজ করে</a>
            <a href="#pricing" className="hover:text-foreground">প্রাইসিং</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">লগইন / Login</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signup">শুরু করুন</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-2 md:py-28">
          <div className="flex flex-col justify-center gap-6">
            <Badge className="w-fit">🚀 Facebook Messenger Chatbot SaaS</Badge>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              আপনার ফেসবুক পেজের{" "}
              <span className="bg-gradient-to-r from-blue-600 to-emerald-500 bg-clip-text text-transparent">
                অটোমেটিক সেলস অ্যাসিস্ট্যান্ট
              </span>
            </h1>
            <p className="text-lg text-muted-foreground">
              পণ্য দেখানো, সাইজ-পরিমাণ নেওয়া, নাম-ফোন-ঠিকানা সংগ্রহ, অর্ডার কনফার্ম —
              সবকিছু মেসেঞ্জারে অটোমেটিক। মানুষ দরকার হলে এক ক্লিকে টেকওভার।
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/signup">
                  ফ্রি তৈরি করুন <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">আগে থেকেই অ্যাকাউন্ট আছে?</Link>
              </Button>
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {["ক্রেডিট কার্ড লাগবে না", "২ মিনিটে সেটআপ", "Bangla + English"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="size-4 text-emerald-500" /> {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Chat preview */}
          <div className="flex items-center justify-center">
            <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-4 shadow-2xl">
              <div className="mb-3 flex items-center gap-2 border-b pb-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                  P
                </div>
                <div>
                  <p className="text-sm font-semibold">Your Page</p>
                  <p className="text-xs text-muted-foreground">Messenger • অনলাইন</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2">
                  আসসালামু আলাইকুম! 👋 পণ্য দেখতে “পণ্য” লিখুন।
                </div>
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-blue-600 px-3 py-2 text-white">
                  পণ্য দেখাও
                </div>
                <div className="rounded-2xl border bg-background p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="h-10 w-10 rounded-md bg-muted" />
                    <div>
                      <p className="text-xs font-semibold">Panjabi Cotton — ৳1,200</p>
                      <p className="text-[10px] text-muted-foreground">সাইজ: S, M, L • স্টক: 24</p>
                    </div>
                  </div>
                  <div className="rounded-md bg-primary px-3 py-1.5 text-center text-xs font-medium text-primary-foreground">
                    🛒 বাছাই করুন
                  </div>
                </div>
                <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2">
                  কতটি নিতে চান? (সর্বোচ্চ 24) সংখ্যা লিখুন।
                </div>
                <div className="ml-auto max-w-[60%] rounded-2xl rounded-br-sm bg-blue-600 px-3 py-2 text-white">
                  2
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border/60 bg-muted/30 py-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">ফিচার / Features</h2>
            <p className="mt-3 text-muted-foreground">
              একটি চ্যাটবট, যা আপনার পুরো সেলস প্রসেস চালায়
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title} className="border-border/70">
                <CardHeader>
                  <span className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <f.icon className="size-5" />
                  </span>
                  <CardTitle className="text-lg">{f.title}</CardTitle>
                  <CardDescription>{f.en}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{f.description}</CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              কীভাবে কাজ করে / How it works
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-border/70 p-6">
                <p className="text-3xl font-bold text-primary/30">{s.n}</p>
                <h3 className="mt-3 font-semibold">{s.title}</h3>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.en}</p>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border/60 bg-muted/30 py-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">প্রাইসিং / Pricing</h2>
            <p className="mt-3 text-muted-foreground">আপনার ব্যবসা অনুযায়ী প্ল্যান বেছে নিন</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {PRICING.map((p) => (
              <Card
                key={p.name}
                className={p.highlight ? "border-primary shadow-lg" : "border-border/70"}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{p.name}</CardTitle>
                    {p.highlight && <Badge>জনপ্রিয়</Badge>}
                  </div>
                  <CardDescription>{p.tagline}</CardDescription>
                  <p className="pt-2 text-3xl font-bold">
                    {p.price}
                    <span className="text-sm font-normal text-muted-foreground">{p.period}</span>
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <ul className="space-y-2 text-sm">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button variant={p.highlight ? "default" : "outline"} asChild className="mt-auto">
                    <Link href="/signup">{p.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto w-full max-w-4xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            আজই আপনার পেজে বট চালু করুন
          </h2>
          <p className="mt-3 text-muted-foreground">
            এক ক্লিকে ফেসবুক পেজ কানেক্ট করুন — টেকনিক্যাল কোনো জ্ঞান লাগবে না।
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/signup">
                এখনই শুরু করুন <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} PageBot — Facebook Chatbot SaaS</p>
          <p>Built with Next.js + Supabase</p>
        </div>
      </footer>
    </div>
  );
}
