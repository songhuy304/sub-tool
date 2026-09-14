"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";

export function HeroSection() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24">
      {/* Glow Backdrops */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-96 w-96 md:h-[32rem] md:w-[48rem] rounded-full bg-gradient-to-b from-amber-500/20 via-yellow-500/10 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-24 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 text-center">
        {/* Top Tag */}
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-500 dark:text-amber-300 backdrop-blur-md shadow-sm">
          <Icons.sparkles className="h-3.5 w-3.5 animate-spin" />
          <span>Hệ Thống Tự Động 100% • Kích Hoạt Trong 3 Giây</span>
        </div>

        {/* Main Headline */}
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl leading-[1.15]">
          Nâng Cấp{" "}
          <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent underline decoration-amber-500/40 underline-offset-8">
            Locket Gold
          </span>{" "}
          <br className="hidden sm:inline" />
          Chỉ Với{" "}
          <span className="relative inline-block">
            <span className="relative z-10 text-foreground">Username</span>
            <span className="absolute bottom-2 left-0 h-3 w-full bg-amber-500/20 rounded -rotate-1" />
          </span>
        </h1>

        {/* Description */}
        <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
          Nhanh gọn, tiện lợi và an toàn tuyệt đối. Nhận ngay huy hiệu vương miện hoàng gia,
          tải ảnh/video HD không giới hạn và trọn bộ đặc quyền cao cấp của Locket Gold mà không cần tài khoản, mật khẩu hay can thiệp iCloud.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <Button
            size="lg"
            onClick={() => scrollTo("pricing")}
            className="w-full sm:w-auto h-12 px-8 bg-gradient-to-r from-amber-500 to-yellow-400 font-bold text-black shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-yellow-300 active:scale-95 transition-all text-base gap-2"
          >
            <Icons.crown className="h-5 w-5" />
            Nâng Cấp Ngay Chỉ Từ 30k
          </Button>

          <Button
            size="lg"
            variant="outline"
            onClick={() => scrollTo("reels")}
            className="w-full sm:w-auto h-12 px-7 border-border/80 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-base gap-2"
          >
            <Icons.video className="h-4 w-4 text-amber-500" />
            Xem Video Hướng Dẫn
          </Button>
        </div>

        {/* Quick Highlights Row */}
        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 max-w-3xl mx-auto pt-6 border-t border-border/60">
          <div className="rounded-xl border border-border/60 bg-card/50 p-3.5 backdrop-blur-sm">
            <div className="text-2xl font-extrabold text-amber-400">⚡ 3 Giây</div>
            <div className="text-xs text-muted-foreground mt-1">Kích hoạt siêu tốc</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/50 p-3.5 backdrop-blur-sm">
            <div className="text-2xl font-extrabold text-amber-400">🛡️ 3 KHÔNG</div>
            <div className="text-xs text-muted-foreground mt-1">An toàn tuyệt đối</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/50 p-3.5 backdrop-blur-sm">
            <div className="text-2xl font-extrabold text-amber-400">💎 1k = 1 Point</div>
            <div className="text-xs text-muted-foreground mt-1">Giá sinh viên siêu rẻ</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/50 p-3.5 backdrop-blur-sm">
            <div className="text-2xl font-extrabold text-amber-400">👑 Trọn Đời</div>
            <div className="text-xs text-muted-foreground mt-1">Bảo hành 1 đổi 1</div>
          </div>
        </div>
      </div>
    </section>
  );
}
