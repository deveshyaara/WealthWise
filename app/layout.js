import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/header";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "WealthWise",
  description: "One stop Finance Platform",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider
      publishableKey={
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
        "pk_test_dGVzdC5jbGVyay5hY2NvdW50cy5kZXYk"
      }
    >
      <html lang="en">
        <head>
          <link rel="icon" href="/logo-sm.png" sizes="any" />
        </head>
        <body className={`${inter.className}`}>
          <Header />
          <main className="min-h-screen">{children}</main>
          <Toaster richColors />

          <footer className="border-t bg-muted/30 py-8">
            <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
              <p>© {new Date().getFullYear()} WealthWise • Intelligent AI Personal Finance Platform</p>
            </div>
          </footer>
        </body>
      </html>
    </ClerkProvider>
  );
}
