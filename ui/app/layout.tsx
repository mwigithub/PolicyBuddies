import type { Metadata } from "next";
import { Sora, JetBrains_Mono } from "next/font/google";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import "./globals.css";

const soraSans = Sora({ variable: "--font-sora-sans", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PolicyBuddies — AI Policy Assistant",
  description: "Ask questions about your insurance policies and get instant AI-powered answers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${soraSans.variable} ${jetbrainsMono.variable} antialiased bg-[#F8FAFC] min-h-screen flex flex-col text-base sm:text-lg`}>
        <Header />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
