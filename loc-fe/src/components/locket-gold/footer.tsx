"use client";

import React from "react";
import { Icons } from "@/components/icons";

export function LocketFooter() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <footer className="border-t border-border/80 bg-background/90 py-12 text-xs text-muted-foreground relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo & Description */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 to-yellow-300 text-black font-bold shadow-md shadow-amber-500/20">
                <Icons.crown className="h-4 w-4" />
              </div>
              <span className="text-base font-extrabold bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
                LocketGold
              </span>
            </div>
            <p className="max-w-md text-muted-foreground text-xs leading-relaxed">
              Dịch vụ nâng cấp Locket Gold tự động chỉ với Username. Cam kết 3 KHÔNG, thanh toán tự động trong 3 giây và bảo hành trọn đời.
            </p>
          </div>

          {/* Quick Links */}
          <div className="flex items-center gap-6 font-medium">
            <button
              onClick={() => scrollTo("features")}
              className="hover:text-amber-400 transition-colors cursor-pointer"
            >
              Tính Năng
            </button>
            <button
              onClick={() => scrollTo("commitments")}
              className="hover:text-amber-400 transition-colors cursor-pointer"
            >
              3 Không
            </button>
            <button
              onClick={() => scrollTo("reels")}
              className="hover:text-amber-400 transition-colors cursor-pointer"
            >
              Video
            </button>
            <button
              onClick={() => scrollTo("pricing")}
              className="hover:text-amber-400 transition-colors cursor-pointer"
            >
              Bảng Giá
            </button>
          </div>
        </div>

        {/* Bottom separator and copyright */}
        <div className="mt-8 border-t border-border/50 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px]">
          <p>© {new Date().getFullYear()} LocketGold. All rights reserved.</p>
          <div className="flex items-center gap-4 text-muted-foreground">
            <span>🛡️ 1 Point = 1.000 VNĐ</span>
            <span>•</span>
            <span>⚡ Kích hoạt tự động 24/7</span>
            <span>•</span>
            <span>💎 Bảo hành trọn đời 1 đổi 1</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
