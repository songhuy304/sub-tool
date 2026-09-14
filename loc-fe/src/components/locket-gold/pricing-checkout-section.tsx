"use client";

import React from "react";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  resolveLocketUsername,
  createPaymentOrder,
  CreateOrderResponse,
  OrderStatusResponse,
  ResolveResponse,
  sanitizeUsername,
} from "@/services/locket-api";
import { toast } from "sonner";
import { PaymentModal } from "./payment-modal";
import { SuccessModal } from "./success-modal";

interface PricingPlan {
  id: "month" | "year";
  title: string;
  duration: string;
  points: number;
  priceVnd: number;
  popular?: boolean;
  savings?: string;
}

const PLANS: PricingPlan[] = [
  {
    id: "month",
    title: "Gói 1 Tháng",
    duration: "30 Ngày sử dụng",
    points: 30,
    priceVnd: 30000,
  },
  {
    id: "year",
    title: "Gói 1 Năm",
    duration: "365 Ngày sử dụng",
    points: 60,
    priceVnd: 60000,
    popular: true,
    savings: "Tiết kiệm 83%",
  },
];

const LOCKET_GOLD_FEATURES = [
  {
    icon: Icons.crown,
    title: "Huy Hiệu Gold Độc Quyền",
    desc: "Vương miện vàng hoàng gia nổi bật ngay trên hồ sơ cá nhân của bạn.",
  },
  {
    icon: Icons.photo,
    title: "Ảnh & Video Chuẩn HD Không Nén",
    desc: "Gửi và lưu giữ khoảnh khắc với độ phân giải cao nhất, sắc nét từng chi tiết.",
  },
  {
    icon: Icons.eye,
    title: "Xem Ai Đã Xem Ảnh Của Bạn",
    desc: "Biết chính xác bạn bè nào đã mở xem bức ảnh bạn vừa gửi.",
  },
  {
    icon: Icons.clock,
    title: "Quay & Gửi Video Dài Hơn",
    desc: "Không bị giới hạn thời gian ngắn, thoải mái chia sẻ trọn vẹn câu chuyện.",
  },
  {
    icon: Icons.slash,
    title: "100% Không Quảng Cáo",
    desc: "Trải nghiệm mượt mà, không gián đoạn, không bao giờ xuất hiện pop-up hay banner.",
  },
  {
    icon: Icons.sparkles,
    title: "Đổi Icon App Phong Cách Gold",
    desc: "Tuỳ chọn biểu tượng Locket mạ vàng sang trọng ngoài màn hình chính điện thoại.",
  },
  {
    icon: Icons.star,
    title: "Bộ Biểu Tượng Cảm Xúc Độc Quyền",
    desc: "Mở khoá toàn bộ reaction đặc biệt để tương tác cùng bạn bè thân thiết.",
  },
  {
    icon: Icons.shield,
    title: "Bảo Hành Trọn Đời 1 Đổi 1",
    desc: "Được hỗ trợ kỹ thuật và bảo hành vĩnh viễn suốt quá trình bạn sử dụng.",
  },
];

export function PricingCheckoutSection() {
  const [selectedPlanId, setSelectedPlanId] = React.useState<"month" | "year">("year");
  const [usernameInput, setUsernameInput] = React.useState("");
  const [isResolving, setIsResolving] = React.useState(false);
  const [resolvedAccount, setResolvedAccount] = React.useState<ResolveResponse | null>(null);

  const [isCreatingOrder, setIsCreatingOrder] = React.useState(false);
  const [currentOrder, setCurrentOrder] = React.useState<CreateOrderResponse | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = React.useState(false);

  const [paidData, setPaidData] = React.useState<OrderStatusResponse | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = React.useState(false);

  const selectedPlan = PLANS.find((p) => p.id === selectedPlanId) || PLANS[1];

  // Handle Resolving Username
  const handleResolve = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const cleaned = sanitizeUsername(usernameInput);
    if (!cleaned) {
      toast.error("Vui lòng nhập Username Locket của bạn!");
      return;
    }

    setIsResolving(true);
    setResolvedAccount(null);

    try {
      const res = await resolveLocketUsername(cleaned);
      if (!res.success) {
        toast.error(res.error || "Không tìm thấy tài khoản Locket này.");
      } else {
        setResolvedAccount(res);
        if (res.status?.active) {
          toast.info(`Tài khoản @${res.username} hiện đã có Gold (Hết hạn: ${res.status.expires || "vĩnh viễn"}). Bạn có thể tiếp tục gia hạn!`);
        } else {
          toast.success(`Tìm thấy tài khoản @${res.username}!`);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Lỗi kiểm tra tài khoản Locket.");
    } finally {
      setIsResolving(false);
    }
  };

  // Handle Creating Order & Opening Payment Modal
  const handleCreateOrder = async () => {
    const usernameToUse = resolvedAccount?.username || sanitizeUsername(usernameInput);
    if (!usernameToUse) {
      toast.error("Vui lòng nhập và kiểm tra Username Locket trước khi thanh toán!");
      return;
    }

    setIsCreatingOrder(true);

    try {
      // First resolve if not yet resolved
      let validUsername = usernameToUse;
      if (!resolvedAccount) {
        const resolveRes = await resolveLocketUsername(usernameToUse);
        if (!resolveRes.success) {
          toast.error(resolveRes.error || "Không tìm thấy tài khoản Locket này.");
          setIsCreatingOrder(false);
          return;
        }
        setResolvedAccount(resolveRes);
        validUsername = resolveRes.username || usernameToUse;
      }

      const orderRes = await createPaymentOrder(validUsername, selectedPlan.priceVnd);
      setCurrentOrder(orderRes);
      setIsPaymentModalOpen(true);
    } catch (err: any) {
      toast.error(err.message || "Không thể tạo đơn hàng thanh toán.");
    } finally {
      setIsCreatingOrder(false);
    }
  };

  // Callback when order is paid
  const handlePaymentSuccess = (data: OrderStatusResponse) => {
    setIsPaymentModalOpen(false);
    setPaidData(data);
    setIsSuccessModalOpen(true);
  };

  return (
    <section id="pricing" className="py-16 sm:py-24 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-400">
            <Icons.sparkles className="h-3.5 w-3.5" />
            <span>Nâng Cấp Siêu Tốc</span>
          </div>
          <h2 className="mt-4 text-3xl font-black sm:text-4xl lg:text-5xl tracking-tight">
            Chọn Gói & Kích Hoạt{" "}
            <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
              Locket Gold
            </span>
          </h2>
          <p className="mt-3 text-muted-foreground text-sm sm:text-base">
            Nhập Username, chọn gói ưu đãi và thanh toán quét mã VietQR tự động trong 3 giây.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Interactive Checkout & Plan Selector (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Step 1: Input Locket Username */}
            <div className="rounded-3xl border border-border/80 bg-card/70 p-6 sm:p-8 backdrop-blur-xl shadow-xl shadow-amber-500/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 font-bold text-sm ring-1 ring-amber-500/30">
                  1
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    Nhập Username Locket Của Bạn
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Chấp nhận dạng: <code className="text-amber-400 font-mono">thanhdo</code>, <code className="text-amber-400 font-mono">@thanhdo</code> hoặc link <code className="text-amber-400 font-mono">locket.cam/...</code>
                  </p>
                </div>
              </div>

              <form onSubmit={handleResolve} className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                    <span className="font-bold text-amber-500">@</span>
                  </div>
                  <Input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => {
                      setUsernameInput(e.target.value);
                      if (resolvedAccount) setResolvedAccount(null);
                    }}
                    placeholder="Nhập username Locket..."
                    className="pl-8 h-12 rounded-xl bg-background/80 border-border/80 focus-visible:ring-amber-500 text-sm font-medium"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isResolving || !usernameInput.trim()}
                  className="h-12 px-5 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 font-semibold gap-2 transition-all shrink-0"
                >
                  {isResolving ? (
                    <>
                      <Icons.spinner className="h-4 w-4 animate-spin text-amber-500" />
                      Đang tìm...
                    </>
                  ) : (
                    <>
                      <Icons.search className="h-4 w-4" />
                      Kiểm Tra
                    </>
                  )}
                </Button>
              </form>

              {/* Resolved User Info Card */}
              {resolvedAccount && resolvedAccount.success && (
                <div className="mt-4 flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 font-bold">
                      <Icons.crown className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">
                          @{resolvedAccount.username}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                          <Icons.check className="h-3 w-3" />
                          Hợp lệ
                        </span>
                      </div>
                      {resolvedAccount.uid && (
                        <p className="text-[11px] font-mono text-muted-foreground truncate max-w-[220px]">
                          UID: {resolvedAccount.uid}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right text-xs">
                    {resolvedAccount.status?.active ? (
                      <span className="font-semibold text-amber-400">
                        Đang có Gold (Được gia hạn)
                      </span>
                    ) : (
                      <span className="font-semibold text-emerald-400">
                        Sẵn sàng nâng cấp
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Select Package */}
            <div className="rounded-3xl border border-border/80 bg-card/70 p-6 sm:p-8 backdrop-blur-xl shadow-xl shadow-amber-500/5">
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 font-bold text-sm ring-1 ring-amber-500/30">
                  2
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    Chọn Gói Nâng Cấp Phù Hợp
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Chọn gói 1 tháng hoặc 1 năm với chính sách bảo hành trọn đời
                  </p>
                </div>
              </div>

              {/* 2 Plans Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {PLANS.map((plan) => {
                  const isSelected = selectedPlanId === plan.id;
                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`relative cursor-pointer rounded-2xl p-5 transition-all duration-300 border-2 ${
                        isSelected
                          ? "border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/15"
                          : "border-border/70 bg-card/50 hover:border-amber-500/40 hover:bg-card"
                      }`}
                    >
                      {/* Popular / Best Value Badge */}
                      {plan.popular && (
                        <div className="absolute -top-3 right-4 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 px-3 py-0.5 text-[10px] font-extrabold text-black shadow-md">
                          {plan.savings || "Được Chọn Nhiều Nhất"}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="font-bold text-base text-foreground">
                          {plan.title}
                        </span>
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                            isSelected
                              ? "border-amber-500 bg-amber-500 text-black"
                              : "border-muted-foreground/40"
                          }`}
                        >
                          {isSelected && <Icons.check className="h-3 w-3 stroke-[3]" />}
                        </div>
                      </div>

                      <div className="mt-4 flex items-baseline gap-1.5">
                        <span className="text-3xl font-black text-amber-400">
                          {plan.points}{" "}
                          <span className="text-lg font-bold text-muted-foreground">
                            Point
                          </span>
                        </span>
                      </div>

                      <div className="mt-1 text-sm font-semibold text-foreground">
                        {plan.priceVnd.toLocaleString("vi-VN")} VNĐ
                      </div>

                      <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground border-t border-border/50 pt-2.5">
                        <Icons.clock className="h-3.5 w-3.5 text-amber-500" />
                        <span>{plan.duration}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Note about points and warranty */}
              <div className="mt-5 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3.5 flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-2 text-amber-400 font-medium">
                  <span>💎 Quy đổi:</span>
                  <strong className="text-foreground">1 Point = 1.000 VNĐ</strong>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <Icons.shield className="h-3.5 w-3.5" />
                  <span>Bảo hành trọn đời & hỗ trợ 24/7</span>
                </div>
              </div>

              {/* Step 3: Checkout Action Button */}
              <div className="mt-6 pt-2">
                <Button
                  size="lg"
                  disabled={isCreatingOrder}
                  onClick={handleCreateOrder}
                  className="w-full h-14 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 font-extrabold text-black text-base shadow-xl shadow-amber-500/25 hover:from-amber-400 hover:to-yellow-300 active:scale-[0.99] transition-all gap-2"
                >
                  {isCreatingOrder ? (
                    <>
                      <Icons.spinner className="h-5 w-5 animate-spin text-black" />
                      Đang Khởi Tạo Đơn Hàng...
                    </>
                  ) : (
                    <>
                      <Icons.crown className="h-5 w-5" />
                      NÂNG CẤP LOCKET GOLD NGAY (
                      {selectedPlan.priceVnd.toLocaleString("vi-VN")}đ)
                    </>
                  )}
                </Button>
                <p className="text-[11px] text-center text-muted-foreground mt-2">
                  ⚡ Thanh toán tự động qua VietQR TPBank • Kích hoạt trong 3 giây
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Exclusive Locket Gold Features List (5 cols) */}
          <div className="lg:col-span-5 rounded-3xl border border-amber-500/20 bg-gradient-to-b from-card/90 via-card/70 to-card/50 p-6 sm:p-8 backdrop-blur-xl shadow-xl">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
              <Icons.crown className="h-4 w-4" />
              Đặc Quyền Vượt Trội
            </div>
            <h3 className="text-2xl font-black tracking-tight text-foreground">
              Locket Gold Có Gì Đặc Biệt?
            </h3>
            <p className="mt-1 text-xs text-muted-foreground mb-6">
              Toàn bộ những tính năng cao cấp nhất sẽ được mở khoá ngay sau khi kích hoạt.
            </p>

            {/* List of features */}
            <div className="space-y-4">
              {LOCKET_GOLD_FEATURES.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={index} className="flex items-start gap-3.5 group">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20 group-hover:bg-amber-500/20 transition-colors">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground group-hover:text-amber-400 transition-colors">
                        {item.title}
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Support Callout */}
            <div className="mt-8 rounded-2xl border border-border/80 bg-background/60 p-4 text-center">
              <p className="text-xs font-semibold text-foreground">
                Cần hỗ trợ kỹ thuật hoặc tư vấn?
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Đội ngũ hỗ trợ LocketGold luôn sẵn sàng phục vụ bạn 24/7.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        order={currentOrder}
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onPaid={handlePaymentSuccess}
      />

      {/* Success Modal */}
      <SuccessModal
        data={paidData}
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
      />
    </section>
  );
}
