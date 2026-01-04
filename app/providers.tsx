"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { ReaderPreferencesProvider } from "@/components/reader/ReaderPreferencesProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ReaderPreferencesProvider>{children}</ReaderPreferencesProvider>
      <Toaster position="top-center" richColors />
    </ThemeProvider>
  );
}
