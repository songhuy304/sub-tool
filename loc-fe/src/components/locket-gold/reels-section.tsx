"use client";

import React from "react";
import { Icons } from "@/components/icons";

/**
 * CẤU HÌNH LINK VIDEO REELS:
 * Bạn có thể dán link trực tiếp (MP4, YouTube Shorts Embed, TikTok Embed, v.v.) vào đây.
 */
export const REELS_CONFIG = {
  // Video 1: Hướng dẫn thanh toán VietQR trong 3 giây
  paymentGuideVideoUrl: "", // Ví dụ: "https://www.youtube.com/embed/your-video-id" hoặc link mp4
  // Video 2: Reels giới thiệu Locket Gold
  locketIntroVideoUrl: "", // Ví dụ: "https://www.youtube.com/embed/your-video-id" hoặc link mp4
};

export function ReelsSection() {
  const [isPlaying1, setIsPlaying1] = React.useState(false);
  const [isPlaying2, setIsPlaying2] = React.useState(false);

  return (
    <section id="reels" className="py-14 sm:py-20 relative bg-muted/20 border-y border-border/50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-400">
            <Icons.video className="h-3.5 w-3.5" />
            <span>Khu Vực Video & Reels Trực Quan</span>
          </div>
          <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl tracking-tight">
            Xem Video Hướng Dẫn & Giới Thiệu
          </h2>
          <p className="mt-3 text-muted-foreground text-sm sm:text-base">
            Tìm hiểu chi tiết các tính năng độc quyền và xem quy trình thanh toán kích hoạt chỉ trong 3 giây.
          </p>
        </div>

        {/* 2 Reels Showcase Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Reel 1: Video Hướng Dẫn Thanh Toán */}
          <div className="flex flex-col items-center">
            <div className="w-full max-w-[340px] aspect-[9/16] relative rounded-[2.5rem] p-3 border-4 border-amber-500/30 bg-gradient-to-b from-neutral-900 via-neutral-950 to-black shadow-2xl shadow-amber-500/10 flex flex-col justify-between overflow-hidden">
              {/* Dynamic Island / Speaker Notch */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 h-4 w-24 bg-neutral-800 rounded-full z-20 flex items-center justify-end px-2">
                <span className="h-2 w-2 rounded-full bg-neutral-950" />
              </div>

              {/* Video Content or Interactive Placeholder */}
              {REELS_CONFIG.paymentGuideVideoUrl ? (
                <iframe
                  src={REELS_CONFIG.paymentGuideVideoUrl}
                  title="Hướng dẫn thanh toán Locket Gold"
                  className="w-full h-full rounded-[2rem] object-cover"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="relative w-full h-full rounded-[2rem] bg-gradient-to-br from-amber-950/40 via-neutral-900 to-black flex flex-col justify-between p-5 overflow-hidden border border-amber-500/20">
                  {/* Floating badge */}
                  <div className="pt-6 flex justify-between items-center z-10">
                    <span className="rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
                      <Icons.sparkles className="h-3 w-3" />
                      3 Giây Hoàn Tất
                    </span>
                    <span className="text-[11px] font-medium text-neutral-400">HD 1080p</span>
                  </div>

                  {/* Center Play Button Graphic */}
                  <div className="flex flex-col items-center justify-center my-auto text-center z-10">
                    <button
                      onClick={() => setIsPlaying1(!isPlaying1)}
                      className="group relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 text-black shadow-lg shadow-amber-500/40 transition-transform active:scale-95 hover:scale-105 cursor-pointer"
                    >
                      <Icons.video className="h-7 w-7 text-black fill-black ml-0.5" />
                      <span className="absolute -inset-2 rounded-full border border-amber-400/40 animate-ping opacity-60" />
                    </button>
                    <h4 className="mt-4 text-base font-bold text-white">
                      Hướng Dẫn Thanh Toán
                    </h4>
                    <p className="mt-1 text-xs text-neutral-300 max-w-[200px]">
                      Quét mã QR SePay TPBank & nhận Gold ngay tức thì
                    </p>
                  </div>

                  {/* Reel Overlay Footer */}
                  <div className="z-10 bg-black/50 backdrop-blur-md rounded-xl p-3 border border-white/10">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                      <Icons.check className="h-3.5 w-3.5" />
                      Bước 1: Nhập username
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-300 mt-1">
                      <Icons.check className="h-3.5 w-3.5" />
                      Bước 2: Quét mã QR thanh toán
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 text-center">
              <h3 className="font-bold text-lg text-foreground flex items-center justify-center gap-1.5">
                <Icons.cashBanknote className="h-4 w-4 text-amber-400" />
                Video Hướng Dẫn Thanh Toán
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Xem quy trình thanh toán VietQR tự động chỉ mất 3 giây
              </p>
            </div>
          </div>

          {/* Reel 2: Reels Giới Thiệu Locket */}
          <div className="flex flex-col items-center">
            <div className="w-full max-w-[340px] aspect-[9/16] relative rounded-[2.5rem] p-3 border-4 border-amber-500/30 bg-gradient-to-b from-neutral-900 via-neutral-950 to-black shadow-2xl shadow-amber-500/10 flex flex-col justify-between overflow-hidden">
              {/* Dynamic Island / Speaker Notch */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 h-4 w-24 bg-neutral-800 rounded-full z-20 flex items-center justify-end px-2">
                <span className="h-2 w-2 rounded-full bg-neutral-950" />
              </div>

              {/* Video Content or Interactive Placeholder */}
              {REELS_CONFIG.locketIntroVideoUrl ? (
                <iframe
                  src={REELS_CONFIG.locketIntroVideoUrl}
                  title="Giới thiệu Locket Gold"
                  className="w-full h-full rounded-[2rem] object-cover"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="relative w-full h-full rounded-[2rem] bg-gradient-to-br from-yellow-950/40 via-neutral-900 to-black flex flex-col justify-between p-5 overflow-hidden border border-amber-500/20">
                  {/* Floating badge */}
                  <div className="pt-6 flex justify-between items-center z-10">
                    <span className="rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-yellow-400 border border-yellow-500/30 flex items-center gap-1.5">
                      <Icons.crown className="h-3 w-3" />
                      Locket Gold Official
                    </span>
                    <span className="text-[11px] font-medium text-neutral-400">Reels</span>
                  </div>

                  {/* Center Play Button Graphic */}
                  <div className="flex flex-col items-center justify-center my-auto text-center z-10">
                    <button
                      onClick={() => setIsPlaying2(!isPlaying2)}
                      className="group relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-yellow-400 to-amber-500 text-black shadow-lg shadow-amber-500/40 transition-transform active:scale-95 hover:scale-105 cursor-pointer"
                    >
                      <Icons.crown className="h-7 w-7 text-black" />
                      <span className="absolute -inset-2 rounded-full border border-yellow-400/40 animate-ping opacity-60" />
                    </button>
                    <h4 className="mt-4 text-base font-bold text-white">
                      Trải Nghiệm Locket Gold
                    </h4>
                    <p className="mt-1 text-xs text-neutral-300 max-w-[200px]">
                      Huy hiệu hoàng gia, ảnh HD & tính năng độc quyền
                    </p>
                  </div>

                  {/* Reel Overlay Footer */}
                  <div className="z-10 bg-black/50 backdrop-blur-md rounded-xl p-3 border border-white/10">
                    <div className="flex items-center gap-2 text-xs font-semibold text-yellow-300">
                      <Icons.check className="h-3.5 w-3.5" />
                      Xem ai đã xem ảnh của bạn
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-yellow-300 mt-1">
                      <Icons.check className="h-3.5 w-3.5" />
                      Gửi video dài hơn & Tải ảnh sắc nét
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 text-center">
              <h3 className="font-bold text-lg text-foreground flex items-center justify-center gap-1.5">
                <Icons.crown className="h-4 w-4 text-yellow-400" />
                Reels Giới Thiệu Locket Gold
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Khám phá trọn bộ đặc quyền cao cấp khi nâng cấp Locket Gold
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
