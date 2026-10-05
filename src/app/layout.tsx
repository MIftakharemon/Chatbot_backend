import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "PageBot — Facebook Messenger Chatbot SaaS",
    template: "%s | PageBot",
  },
  description:
    "ফেসবুক পেজের জন্য অটোমেটিক মেসেঞ্জার চ্যাটবট — পণ্য দেখানো, অর্ডার নেওয়া, কমেন্ট রিপ্লাই ও লাইভ কথোপকথন। Multi-tenant Facebook Messenger chatbot SaaS for e-commerce pages.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="bn"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster position="top-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
