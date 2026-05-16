import { BRAND } from "@/lib/brand";

export function Logo({ size = "md", gradient = false }: { size?: "sm" | "md" | "lg" | "xl"; gradient?: boolean }) {
  const cls = {
    sm: "text-xl",
    md: "text-[26px] leading-none",
    lg: "text-4xl",
    xl: "text-6xl",
  }[size];
  return (
    <span
      className={`font-display font-extrabold tracking-tight ${gradient ? "text-gradient" : "text-foreground"} ${cls}`}
    >
      {BRAND.name}
    </span>
  );
}
