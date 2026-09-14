// lib/metadata.ts
import type { Metadata } from "next";
import { APP_NAME } from "@/config/app.config";

export function createMetadata(
  title: string,
  description?: string,
  meta?: Metadata,
): Metadata {
  return {
    title: `${title ? `${title} | ` : ""}${APP_NAME}`,
    description,
    ...meta,
  };
}
