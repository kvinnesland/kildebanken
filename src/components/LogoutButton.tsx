"use client";

import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { Button } from "@/components/Button";

export function LogoutButton({ locale }: { locale: SupportedLocale }) {
  const t = createTranslator(locale);
  const router = useRouter();

  async function handlePress() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(`/${locale}/logg-inn`);
    router.refresh();
  }

  return (
    <Button variant="ghost" onPress={handlePress}>
      {t("nav.log_out")}
    </Button>
  );
}
