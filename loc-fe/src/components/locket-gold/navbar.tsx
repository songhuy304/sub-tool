"use client";

import React from "react";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";

export function LocketNavbar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-amber-500/15 bg-background/80 backdrop-blur-xl transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="group flex cursor-pointer items-center gap-2.5 transition-transform active:scale-95"
        >
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 shadow-md shadow-amber-500/30 ring-1 ring-amber-400/40">
            <Icons.crown className="h-5 w-5 text-black transition-transform duration-300 group-hover:scale-110" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-black tracking-tight bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
                LocketGold
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <button
            onClick={() => scrollToSection("reels")}
            className="hover:text-amber-400 transition-colors cursor-pointer"
          >
            Video Hướng Dẫn
          </button>
          <button
            onClick={() => scrollToSection("pricing")}
            className="hover:text-amber-400 transition-colors cursor-pointer"
          >
            Bảng Giá
          </button>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          {/* Status Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Hệ thống kích hoạt 3s
          </div>

          {/* Theme Toggle */}
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title="Đổi giao diện sáng/tối"
            >
              {theme === "dark" ? (
                <Icons.sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Icons.moon className="h-4 w-4 text-slate-700" />
              )}
            </Button>
          )}

          {/* CTA Button */}
          <Button
            onClick={() => scrollToSection("pricing")}
            className="h-9 gap-1.5 bg-gradient-to-r from-amber-500 to-yellow-400 px-4 font-semibold text-black shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-yellow-300 active:scale-95 transition-all"
          >
            <Icons.sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Nâng Cấp</span> Ngay
          </Button>
        </div>
      </div>
    </header>
  );
}
