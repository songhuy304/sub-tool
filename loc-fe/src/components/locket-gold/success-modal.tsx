"use client";

import React from "react";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { OrderStatusResponse } from "@/services/locket-api";
import { triggerConfetti } from "@/lib/confetti";

interface SuccessModalProps {
  data: OrderStatusResponse | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SuccessModal({ data, isOpen, onClose }: SuccessModalProps) {
  React.useEffect(() => {
    if (isOpen) {
      triggerConfetti();
      const secondBurst = setTimeout(() => triggerConfetti(), 800);
      return () => clearTimeout(secondBurst);
    }
  }, [isOpen]);

  if (!data) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md w-[95vw] rounded-3xl border-2 border-amber-500/40 bg-background/95 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl text-center">
        <DialogHeader className="items-center">
          {/* Animated Gold Trophy / Crown Avatar */}
          <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-amber-500 to-yellow-300 shadow-xl shadow-amber-500/30 ring-4 ring-amber-400/50 mb-3 animate-bounce">
            <Icons.crown className="h-10 w-10 text-black fill-black" />
            <span className="absolute -top-1 -right-1 text-2xl">🎉</span>
          </div>

          <DialogTitle className="text-2xl font-black tracking-tight text-foreground">
            Kích Hoạt Gold Thành Công!
          </DialogTitle>
          <DialogDescription className="text-sm text-amber-500 dark:text-amber-400 font-semibold mt-1">
            Chúc mừng bạn đã sở hữu đặc quyền Locket Gold vĩnh viễn
          </DialogDescription>
        </DialogHeader>

        {/* Account Details Box */}
        <div className="mt-4 rounded-2xl bg-card/80 border border-amber-500/30 p-4 text-left shadow-sm">
          <div className="flex items-center justify-between text-xs py-1 border-b border-border/60">
            <span className="text-muted-foreground">Tài khoản Locket:</span>
            <span className="font-bold text-foreground">@{data.username}</span>
          </div>
          <div className="flex items-center justify-between text-xs py-1 border-b border-border/60">
            <span className="text-muted-foreground">Trạng thái:</span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-400">
              <Icons.check className="h-3.5 w-3.5" />
              ĐÃ KÍCH HOẠT (GOLD ACTIVE)
            </span>
          </div>
          {data.uid && (
            <div className="flex items-center justify-between text-xs py-1">
              <span className="text-muted-foreground">UID Thiết Bị:</span>
              <span className="font-mono text-muted-foreground text-[11px] truncate max-w-[180px]">
                {data.uid}
              </span>
            </div>
          )}
        </div>

        {/* 2 Next Steps Guidelines */}
        <div className="mt-5 space-y-3 text-left">
          <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5">
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-400">
                1
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">
                  Mở ứng dụng Locket trên điện thoại
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Vào trang cá nhân để chiêm ngưỡng huy hiệu Locket Gold màu vàng hoàng gia ngay lập tức.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5">
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-400">
                2
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-foreground">
                  Cài đặt DNS Chống Mất Gold (Khuyên dùng)
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Cài đặt hồ sơ cấu hình DNS chính chủ Apple để bảo vệ Gold vĩnh viễn không bao giờ bị thu hồi.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-2.5">
          {data.dns_link && (
            <a
              href={data.dns_link}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full"
            >
              <Button
                size="lg"
                className="w-full h-12 bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-extrabold shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-yellow-300 gap-2"
              >
                <Icons.shield className="h-5 w-5" />
                Cài Đặt DNS Chống Mất Gold
                <Icons.externalLink className="h-4 w-4 ml-1" />
              </Button>
            </a>
          )}

          <Button
            variant="outline"
            onClick={onClose}
            className="w-full border-border/80 text-xs text-muted-foreground hover:text-foreground"
          >
            Đóng & Trải Nghiệm Locket Gold
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
