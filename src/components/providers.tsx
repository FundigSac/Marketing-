"use client";

import { ThemeProvider } from "next-themes";
import { MotionConfig } from "motion/react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
      <MotionConfig reducedMotion="user">
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </MotionConfig>
    </ThemeProvider>
  );
}
