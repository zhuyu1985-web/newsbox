"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { ReaderPreferencesProvider } from "@/components/reader/ReaderPreferencesProvider";
import { MembershipProvider } from "@/components/providers/MembershipProvider";
import { UpgradeDialogProvider } from "@/components/ui/upgrade-dialog";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="newsbox-theme">
      <MembershipProvider>
        <UpgradeDialogProvider>
          <ReaderPreferencesProvider>{children}</ReaderPreferencesProvider>
        </UpgradeDialogProvider>
      </MembershipProvider>
      <Toaster position="top-center" richColors />
    </ThemeProvider>
  );
}
