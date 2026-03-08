"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";

export function Header() {
  const pathname = usePathname();

  return (
    <header className="bg-white/95 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold bg-[#2563EB]">
            PB
          </div>
          <span className="text-base font-bold text-gray-900">PolicyBuddies</span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-6">
          <Link
            href="/"
            className={`text-sm font-medium transition-colors ${
              pathname === "/" ? "text-[#2563EB]" : "text-gray-700 hover:text-gray-900"
            }`}
          >
            Ask Questions
          </Link>
          <Link
            href="/admin"
            className={`text-sm font-medium transition-colors ${
              pathname === "/admin" ? "text-[#2563EB]" : "text-gray-700 hover:text-gray-900"
            }`}
          >
            Admin
          </Link>
          <button className="text-gray-500 hover:text-gray-700 transition-colors">
            <Settings size={18} />
          </button>
        </nav>
      </div>
    </header>
  );
}
