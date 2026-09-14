"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { toast } from "sonner";

import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";

export const typographyVariants = cva("", {
  variants: {
    variant: {
      h1: "text-5xl leading-tight font-medium tracking-tight",
      h2: "text-4xl leading-tight font-medium tracking-tight",
      h3: "text-3xl leading-tight font-medium tracking-tight",
      h4: "text-2xl leading-snug font-medium tracking-tight",
      h5: "md:text-lg lg:text-xl leading-snug font-medium",
      h6: "text-lg leading-normal font-medium",

      "label-xl": "text-xl font-medium tracking-tight",
      "label-lg": "text-lg font-medium tracking-tight",
      "label-md": "text-base font-medium tracking-tight",
      "label-sm": "text-sm font-medium tracking-tight",
      "label-xs": "text-xs font-medium",

      "paragraph-xl": "text-xl leading-relaxed",
      "paragraph-lg": "text-lg leading-relaxed",
      "paragraph-md": "text-base leading-relaxed",
      "paragraph-sm": "text-sm leading-relaxed",
      "paragraph-xs": "text-xs leading-normal",

      "subheading-md": "text-base font-medium tracking-wide",
      "subheading-sm": "text-sm font-medium tracking-wide",
      "subheading-xs": "text-xs font-medium tracking-wider",
      "subheading-2xs": "text-[11px] font-medium tracking-widest",

      "doc-label": "text-lg font-medium leading-relaxed",
      "doc-paragraph": "text-lg leading-relaxed",
    },

    color: {
      default: "text-foreground",
      muted: "text-muted-foreground",
      success: "text-green-600 dark:text-green-400",
      warning: "text-yellow-600 dark:text-yellow-400",
      error: "text-red-600 dark:text-red-400",
      info: "text-blue-600 dark:text-blue-400",
      white: "text-white",
      black: "text-black",
      primary: "text-primary",
      secondary: "text-secondary",
    },

    align: {
      left: "text-left",
      center: "text-center",
      right: "text-right",
      justify: "text-justify",
    },

    truncate: {
      true: "truncate",
      1: "line-clamp-1",
      2: "line-clamp-2",
      3: "line-clamp-3",
      4: "line-clamp-4",
      5: "line-clamp-5",
    },
  },

  defaultVariants: {
    variant: "paragraph-md",
    color: "default",
    align: "left",
  },
});

type TypographyVariant = NonNullable<VariantProps<typeof typographyVariants>["variant"]>;

const defaultElement: Record<TypographyVariant, React.ElementType> = {
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  h5: "h5",
  h6: "h6",

  "label-xl": "p",
  "label-lg": "p",
  "label-md": "p",
  "label-sm": "p",
  "label-xs": "p",

  "paragraph-xl": "p",
  "paragraph-lg": "p",
  "paragraph-md": "p",
  "paragraph-sm": "p",
  "paragraph-xs": "p",

  "subheading-md": "p",
  "subheading-sm": "p",
  "subheading-xs": "p",
  "subheading-2xs": "span",

  "doc-label": "p",
  "doc-paragraph": "p",
};

function getTextFromChildren(children: React.ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }

  if (Array.isArray(children)) {
    return children.map(getTextFromChildren).join("");
  }

  if (React.isValidElement<{ children?: React.ReactNode }>(children)) {
    return getTextFromChildren(children.props.children);
  }

  return "";
}

export interface TypographyProps
  extends
    Omit<React.HTMLAttributes<HTMLElement>, "color">,
    VariantProps<typeof typographyVariants> {
  as?: React.ElementType;
  copy?: boolean | string;
  onCopied?: (value: string) => void;
}

const Typography = React.forwardRef<HTMLElement, TypographyProps>(
  (
    {
      as,
      variant = "paragraph-md",
      color,
      align,
      truncate,
      copy,
      onCopied,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const Component = as ?? defaultElement[variant ?? "paragraph-md"] ?? "p";
    const [isCopied, setIsCopied] = React.useState(false);

    const content = (
      <Component
        ref={copy ? undefined : ref}
        data-slot="typography"
        className={cn(typographyVariants({ variant, color, align, truncate }), className)}
        {...props}
      >
        {children}
      </Component>
    );

    if (!copy) {
      return content;
    }

    const copyValue = typeof copy === "string" ? copy : getTextFromChildren(children);

    const handleCopy = async () => {
      if (!copyValue) {
        return;
      }

      try {
        setIsCopied(true);
        await navigator.clipboard.writeText(copyValue);
        setTimeout(() => setIsCopied(false), 2000);
        onCopied?.(copyValue);
      } catch {
        toast.error("Failed to copy");
        setIsCopied(false);
      }
    };

    return (
      <span
        ref={ref as React.Ref<HTMLSpanElement>}
        className="group inline-flex max-w-full items-center gap-1"
      >
        {content}
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy to clipboard"
          className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center justify-center rounded-sm transition-opacity focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {isCopied ? (
            <Icons.check className="size-3.5 text-green-500" />
          ) : (
            <Icons.copy className="size-3.5 " />
          )}
        </button>
      </span>
    );
  }
);

Typography.displayName = "Typography";

export { Typography };
