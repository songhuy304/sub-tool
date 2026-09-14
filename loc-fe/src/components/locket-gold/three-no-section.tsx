"use client";

import React from "react";
import { Icons } from "@/components/icons";

export function ThreeNoSection() {
  const commitments = [
    {
      badge: "KHÔNG 1",
      title: "Không Đăng Nhập iCloud",
      highlight: "Không can thiệp Apple ID",
      description:
        "Hoàn toàn không yêu cầu hay can thiệp vào tài khoản Apple ID / iCloud của bạn. Bạn không bao giờ phải lo lắng về việc bị lộ dữ liệu nhạy cảm hay dính khoá thiết bị.",
      icon: Icons.shield,
      color: "from-amber-500/20 to-yellow-500/5",
      border: "border-amber-500/30",
      accent: "text-amber-400",
    },
    {
      badge: "KHÔNG 2",
      title: "Không Cần Mật Khẩu & Tài Khoản",
      highlight: "Chỉ cần duy nhất Username",
      description:
        "Bạn chỉ cần cung cấp Username Locket công khai (hoặc link locket.cam). Không ai có thể can thiệp vào tài khoản, tin nhắn riêng tư hay hình ảnh cá nhân của bạn.",
      icon: Icons.lock,
      color: "from-yellow-500/20 to-amber-500/5",
      border: "border-yellow-500/30",
      accent: "text-yellow-400",
    },
    {
      badge: "KHÔNG 3",
      title: "Không Cần Shadowrocket / Proxy",
      highlight: "Không cài đặt app bên thứ 3",
      description:
        "Không cần cài thêm app Shadowrocket hay các công cụ can thiệp mạng phức tạp, gây hao pin hay mất mạng. Hệ thống kích hoạt trực tiếp chuẩn sạch 100%.",
      icon: Icons.sparkles,
      color: "from-amber-500/20 to-orange-500/5",
      border: "border-orange-500/30",
      accent: "text-amber-500",
    },
  ];

  return (
    <section id="commitments" className="py-14 sm:py-20 relative">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-400">
            <Icons.shield className="h-3.5 w-3.5" />
            <span>Tiêu Chuẩn Bảo Mật Hàng Đầu</span>
          </div>
          <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl tracking-tight">
            Cam Kết{" "}
            <span className="bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
              3 KHÔNG
            </span>{" "}
            An Toàn Tuyệt Đối
          </h2>
          <p className="mt-3 text-muted-foreground text-sm sm:text-base">
            Chúng tôi cam kết bảo vệ 100% quyền riêng tư và thiết bị của bạn khi nâng cấp Locket Gold.
          </p>
        </div>

        {/* 3 Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {commitments.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                className={`relative group overflow-hidden rounded-2xl border ${item.border} bg-card/60 p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/10`}
              >
                {/* Gradient background glow */}
                <div
                  className={`pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-gradient-to-br ${item.color} blur-2xl transition-all group-hover:scale-125`}
                />

                {/* Badge */}
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-400 ring-1 ring-amber-500/30">
                    {item.badge}
                  </span>
                  <div className={`p-2.5 rounded-xl bg-amber-500/10 ${item.accent}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>

                {/* Content */}
                <h3 className="mt-4 text-lg font-bold text-foreground">
                  {item.title}
                </h3>
                <div className="mt-1 text-xs font-medium text-amber-400/90">
                  {item.highlight}
                </div>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>

                {/* Bottom line indicator */}
                <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <Icons.check className="h-4 w-4" />
                  <span>Cam kết an toàn trọn đời</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
