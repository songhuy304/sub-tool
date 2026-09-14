import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const baseConfig: NextConfig = {
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.slingacademy.com",
      },
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
      {
        protocol: "https",
        hostname: "clerk.com",
      },
      {
        protocol: "https",
        hostname: "*.storage.supabase.co",
      },
    ],
  },
  transpilePackages: ["geist"],
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
};

let configWithPlugins: NextConfig = withNextIntl(baseConfig);

if (!process.env.NEXT_PUBLIC_SENTRY_DISABLED) {
  configWithPlugins = withSentryConfig(configWithPlugins, {
    org: process.env.NEXT_PUBLIC_SENTRY_ORG,
    project: process.env.NEXT_PUBLIC_SENTRY_PROJECT,
    silent: !process.env.CI,
    widenClientFileUpload: true,
    tunnelRoute: "/monitoring",
    telemetry: false,
    webpack: {
      reactComponentAnnotation: {
        enabled: true,
      },
      treeshake: {
        removeDebugLogging: true,
      },
    },
    sourcemaps: {
      disable:
        !process.env.NEXT_PUBLIC_SENTRY_ORG ||
        !process.env.NEXT_PUBLIC_SENTRY_PROJECT,
    },
  });
}

export default configWithPlugins;
