export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const DOUYIN_API_URL =
  process.env.NEXT_PUBLIC_DOUYIN_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8001";
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Douyin Download";
export const IS_PRODUCTION = process.env.NODE_ENV === "production";

