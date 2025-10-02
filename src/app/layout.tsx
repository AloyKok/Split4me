import type { Metadata } from "next";
import { cn } from "@/lib/utils";
import { Footer } from "@/components/Footer";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Split4me – Fast & Fair Bill Splitting",
  description: "Snap receipts or enter totals to split bills fairly across friends in Singapore and Malaysia.",
  applicationName: "Split4me",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png" },
      { url: "/logo-split4me.svg", type: "image/svg+xml" },
    ],
  },
  openGraph: {
    type: "website",
    title: "Split4me",
    description: "Snap receipts or enter totals to split bills fairly across friends in Singapore and Malaysia.",
    url: "https://split.sgmy.local",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={cn("min-h-screen bg-background text-foreground antialiased font-sans")}
      >
        <div className="flex min-h-screen flex-col">
          <div className="flex-1">{children}</div>
          <Footer />
        </div>
        <Toaster richColors closeButton position="bottom-center" />
      </body>
    </html>
  );
}
