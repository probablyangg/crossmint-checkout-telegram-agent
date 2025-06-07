import { cn } from "@/lib/utils";

export function Container({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-3xl border bg-white p-6 shadow-sm", className)}>{children}</div>
  );
}
