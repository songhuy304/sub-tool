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
import { checkPaymentStatus, CreateOrderResponse, OrderStatusResponse } from "@/services/locket-api";
import { toast } from "sonner";

interface PaymentModalProps {
  order: CreateOrderResponse | null;
  isOpen: boolean;
  onClose: () => void;
  onPaid: (data: OrderStatusResponse) => void;
}

export function PaymentModal({
  order,
  isOpen,
  onClose,
  onPaid,
}: PaymentModalProps) {
  const [timeLeft, setTimeLeft] = React.useState(10 * 60); // 10 minutes in seconds
  const [isExpired, setIsExpired] = React.useState(false);
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  // Timer Countdown
  React.useEffect(() => {
    if (!isOpen || !order) {
      setTimeLeft(10 * 60);
      setIsExpired(false);
      return;
    }

    setTimeLeft(10 * 60);
    setIsExpired(false);

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, order]);

  // Polling every 2.5s (2500ms)
  React.useEffect(() => {
    if (!isOpen || !order || isExpired) return;

    let isPolling = true;

    const pollInterval = setInterval(async () => {
      if (!isPolling) return;

      try {
        const statusRes = await checkPaymentStatus(order.order_id);

        if (statusRes.status === "PAID") {
          isPolling = false;
          clearInterval(pollInterval);
          onPaid(statusRes);
        } else if (statusRes.status === "FAILED") {
          isPolling = false;
          clearInterval(pollInterval);
          toast.error("Thanh toán thất bại hoặc số tiền chuyển chưa chính xác.");
        }
      } catch {
        // Polling error (could be temporary network hiccup, keep polling)
      }
    }, 2500);

    return () => {
      isPolling = false;
      clearInterval(pollInterval);
    };
  }, [isOpen, order, isExpired, onPaid]);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(label);
      toast.success(`Đã sao chép ${label}!`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error("Không thể sao chép vào bộ nhớ tạm.");
    }
  };

  if (!order) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md w-[95vw] rounded-2xl border-amber-500/30 bg-background/95 p-6 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/30 mb-2">
            <Icons.cashBanknote className="h-6 w-6" />
          </div>
          <DialogTitle className="text-xl font-extrabold text-foreground">
            Quét Mã VietQR Thanh Toán
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Mở ứng dụng ngân hàng bất kỳ để quét mã QR thanh toán tự động trong 3 giây
          </DialogDescription>
        </DialogHeader>

        {/* Countdown & Order Code Header */}
        <div className="flex items-center justify-between rounded-xl bg-amber-500/10 border border-amber-500/20 px-3.5 py-2 mt-2">
          <div className="text-xs font-semibold text-foreground">
            Mã đơn: <span className="text-amber-400 font-mono font-bold">{order.order_code}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
            <Icons.clock className="h-3.5 w-3.5 animate-pulse" />
            <span className="font-mono text-sm">{formattedTime}</span>
          </div>
        </div>

        {/* QR Code Container */}
        <div className="relative mt-3 flex flex-col items-center justify-center rounded-2xl border border-amber-500/20 bg-white p-4 shadow-inner">
          {order.qr_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={order.qr_url}
              alt="Mã QR Thanh Toán VietQR TPBank"
              className="h-60 w-60 object-contain rounded-lg"
            />
          ) : (
            <div className="flex h-60 w-60 flex-col items-center justify-center text-neutral-400 text-xs text-center">
              <Icons.spinner className="h-8 w-8 animate-spin text-amber-500 mb-2" />
              Đang tải mã QR...
            </div>
          )}

          {isExpired && (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/85 backdrop-blur-sm p-4 text-center">
              <Icons.alertCircle className="h-10 w-10 text-rose-500 mb-2" />
              <p className="font-bold text-white text-sm">Mã thanh toán đã hết hạn</p>
              <p className="text-xs text-neutral-400 mt-1">Vui lòng đóng và tạo lại đơn mới.</p>
              <Button
                onClick={onClose}
                size="sm"
                className="mt-3 bg-amber-500 hover:bg-amber-400 text-black font-bold"
              >
                Đóng & Tạo Lại
              </Button>
            </div>
          )}
        </div>

        {/* Live Status Indicator */}
        <div className="flex items-center justify-center gap-2 text-xs font-medium text-amber-400 mt-1">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
          <span>Hệ thống đang chờ nhận tiền và kích hoạt tự động...</span>
        </div>

        {/* Manual Transfer Information */}
        <div className="mt-3 space-y-2 rounded-xl border border-border/80 bg-card/60 p-3 text-xs">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Thông tin chuyển khoản thủ công
          </div>

          {/* Ngân hàng */}
          <div className="flex items-center justify-between py-1 border-b border-border/50">
            <span className="text-muted-foreground">Ngân hàng:</span>
            <span className="font-bold text-foreground">{order.bank || "TPBank"}</span>
          </div>

          {/* STK */}
          <div className="flex items-center justify-between py-1 border-b border-border/50">
            <span className="text-muted-foreground">Số tài khoản:</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-foreground">{order.account_number}</span>
              <button
                onClick={() => copyToClipboard(order.account_number, "Số tài khoản")}
                className="rounded p-1 text-muted-foreground hover:text-amber-400 transition-colors"
                title="Sao chép số tài khoản"
              >
                {copiedField === "Số tài khoản" ? (
                  <Icons.check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Icons.copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Số tiền */}
          <div className="flex items-center justify-between py-1 border-b border-border/50">
            <span className="text-muted-foreground">Số tiền:</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-amber-400">
                {order.amount?.toLocaleString("vi-VN")} đ
              </span>
              <button
                onClick={() => copyToClipboard(order.amount.toString(), "Số tiền")}
                className="rounded p-1 text-muted-foreground hover:text-amber-400 transition-colors"
                title="Sao chép số tiền"
              >
                {copiedField === "Số tiền" ? (
                  <Icons.check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Icons.copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Nội dung chuyển khoản */}
          <div className="flex items-center justify-between py-1 bg-amber-500/10 px-2 rounded-lg border border-amber-500/20">
            <span className="font-semibold text-amber-400">Nội dung CK:</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-extrabold text-amber-300 text-sm">
                {order.payment_content}
              </span>
              <button
                onClick={() => copyToClipboard(order.payment_content, "Nội dung chuyển khoản")}
                className="rounded bg-amber-500/20 p-1 text-amber-400 hover:bg-amber-500/30 transition-colors"
                title="Sao chép nội dung CK"
              >
                {copiedField === "Nội dung chuyển khoản" ? (
                  <Icons.check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Icons.copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Warning Note */}
        <p className="text-[11px] text-center text-muted-foreground leading-snug">
          ⚠️ <strong className="text-amber-400">Lưu ý quan trọng:</strong> Giữ nguyên nội dung chuyển khoản để hệ thống ghi nhận và kích hoạt Locket Gold cho bạn sau 3 giây!
        </p>
      </DialogContent>
    </Dialog>
  );
}
