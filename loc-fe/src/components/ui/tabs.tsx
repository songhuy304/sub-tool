"use client";

import { motion, MotionConfig, useReducedMotion, type Transition } from "motion/react";
import {
  ComponentType,
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/ease";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";

type Variant = "pill" | "underline" | "segment";

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
  layoutId: string;
  variant: Variant;
};

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs() {
  const context = useContext(TabsContext);

  if (!context) {
    throw new Error("Tabs.* must be used inside <Tabs>");
  }

  return context;
}

const transition: Transition = {
  type: "spring",
  stiffness: 170,
  damping: 24,
  mass: 1.2,
};

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  variant = "pill",
  children,
  className,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  variant?: Variant;
  children: ReactNode;
  className?: string;
}) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const layoutId = useId();
  const reduceMotion = useReducedMotion();

  const controlled = value !== undefined;
  const currentValue = controlled ? value : internalValue;

  const setValue = useCallback(
    (nextValue: string) => {
      if (!controlled) {
        setInternalValue(nextValue);
      }

      onValueChange?.(nextValue);
    },
    [controlled, onValueChange]
  );

  const contextValue = useMemo(
    () => ({
      value: currentValue,
      setValue,
      layoutId,
      variant,
    }),
    [currentValue, layoutId, setValue, variant]
  );

  return (
    <MotionConfig transition={reduceMotion ? { duration: 0 } : transition}>
      <TabsContext.Provider value={contextValue}>
        <motion.div layoutRoot className={className}>
          {children}
        </motion.div>
      </TabsContext.Provider>
    </MotionConfig>
  );
}

const listClasses: Record<Variant, string> = {
  pill: "inline-flex w-fit items-center gap-1 rounded-lg bg-muted p-[3px] text-muted-foreground",
  segment:
    "inline-flex w-fit items-center gap-0 rounded-lg bg-muted p-[3px] text-muted-foreground",
  underline: "inline-flex w-fit items-center gap-1 border-b border-border",
};

export function TabsList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { variant } = useTabs();

  return (
    <div role="tablist" className={cn(listClasses[variant], className)}>
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  className,
  indicatorClassName,
  icon: Icon,
  disabled,
  meta,
}: {
  value: string;
  children: ReactNode;
  className?: string;
  indicatorClassName?: string;
  icon?: ComponentType<{ className?: string }>;
  disabled?: boolean;
  meta?: {
    count?: number;
    isLoading?: boolean;
  };
}) {
  const { value: currentValue, setValue, layoutId, variant } = useTabs();

  const active = currentValue === value;

  if (variant === "underline") {
    return (
      <button
        type="button"
        role="tab"
        aria-selected={active}
        disabled={disabled}
        onClick={() => setValue(value)}
        className={cn(
          "cursor-pointer relative inline-flex min-h-10 items-center justify-center px-3 py-2 text-sm font-medium transition-colors outline-none",
          active ? "text-foreground" : "text-foreground/60 hover:text-foreground",
          className
        )}
      >
        {Icon ? <Icon className="relative z-10 size-4 mr-2" /> : null}
        {children}
        {meta?.count !== undefined && (
          <Badge variant="secondary" className="rounded-full text-xs p-0 size-5 ml-2">
            {meta?.isLoading ? <Spinner className="size-4" /> : meta?.count}
          </Badge>
        )}

        {active && (
          <motion.span
            layoutId={layoutId}
            className={cn(
              "absolute inset-x-0 -bottom-px h-0.5 bg-primary",
              indicatorClassName
            )}
          />
        )}
      </button>
    );
  }

  return (
    <div className="relative">
      {active && (
        <motion.span
          layoutId={layoutId}
          className={cn(
            "absolute inset-0 rounded-md border border-border bg-background shadow-sm",
            indicatorClassName
          )}
        />
      )}

      <button
        type="button"
        role="tab"
        disabled={disabled}
        aria-selected={active}
        onClick={() => setValue(value)}
        className={cn(
          "cursor-pointer relative z-10 inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none",
          active ? "text-foreground" : "text-foreground/60 hover:text-foreground",
          className
        )}
      >
        {children}
      </button>
    </div>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const { value: currentValue } = useTabs();
  const reduceMotion = useReducedMotion();

  if (currentValue !== value) {
    return (
      <div hidden className={className}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      key={value}
      initial={{
        opacity: 0,
        y: reduceMotion ? 0 : 4,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.18,
        ease: EASE_OUT,
      }}
      className={cn("mt-4", className)}
    >
      {children}
    </motion.div>
  );
}
