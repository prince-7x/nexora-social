import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import logo from "@/assets/nexora-logo.jpg";
import { BRAND } from "@/lib/brand";

const KEY = "nexora_splash_seen_v1";

export function Splash() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(KEY)) return;
    setShow(true);
    sessionStorage.setItem(KEY, "1");
    const t = setTimeout(() => setShow(false), 2200);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05, filter: "blur(12px)" }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
        >
          {/* radial glow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 60% 40% at 50% 50%, oklch(0.6 0.27 320 / 0.35), transparent 70%)",
            }}
          />

          <div className="relative flex flex-col items-center gap-6">
            <motion.div
              initial={{ scale: 0.4, opacity: 0, rotate: -8 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <motion.div
                animate={{
                  boxShadow: [
                    "0 0 40px oklch(0.7 0.27 0 / 0.4)",
                    "0 0 80px oklch(0.62 0.26 295 / 0.6)",
                    "0 0 40px oklch(0.7 0.27 0 / 0.4)",
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="rounded-3xl overflow-hidden"
              >
                <img src={logo} alt={BRAND.name} className="w-32 h-32 object-cover" />
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.7, ease: "easeOut" }}
              className="text-center"
            >
              <h1 className="font-display text-4xl font-bold tracking-tight text-gradient">
                {BRAND.name}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{BRAND.tagline}</p>
            </motion.div>

            <motion.div
              initial={{ width: 0 }}
              animate={{ width: 120 }}
              transition={{ delay: 0.9, duration: 1.1, ease: "easeInOut" }}
              className="h-[2px] rounded-full bg-gradient-brand"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
