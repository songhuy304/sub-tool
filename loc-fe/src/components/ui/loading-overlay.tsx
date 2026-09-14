import { cn } from "@/lib/utils";
import { Icons } from "../icons";

interface LoadingOverlayProps {
  className?: string;
  loading: boolean;
}

export const LoadingOverlay = ({ className, loading }: LoadingOverlayProps) => {
  if (!loading) return <></>;
  return (
    <div
      className={cn(
        "absolute inset-0 z-50 flex items-center justify-center rounded-[inherit] bg-background/50 backdrop-blur-xs ",
        className
      )}
    >
      <Icons.spinner className="size-5 animate-spin" />
    </div>
  );
};
