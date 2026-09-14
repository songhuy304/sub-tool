import { useTranslations } from "next-intl";

export type Locale = (typeof locales)[number];

export const locales = ["en", "vi"] as const;
export const defaultLocale: Locale = "en";
export type TFunction = ReturnType<typeof useTranslations>;
