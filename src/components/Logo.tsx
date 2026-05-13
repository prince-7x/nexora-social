import { BRAND } from "@/lib/brand";

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" | "xl" }) {
  const cls = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-4xl",
    xl: "text-6xl",
  }[size];
  return (
    <span className={`font-display font-bold tracking-tight text-gradient ${cls}`}>
      {BRAND.name}
    </span>
  );
}
