"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { mineResponseStatusTone } from "@/lib/responses/status-badge";
import type { MineResponseDisplayStatus } from "@/lib/responses/responses";
import styles from "./page.module.css";

interface MyResponseItemData {
  id: string;
  requestTitle: string;
  organizationName: string;
  displayStatus: MineResponseDisplayStatus;
  canWithdraw: boolean;
  submittedAtLabel: string;
}

function ResponseListItem({ locale, item }: { locale: SupportedLocale; item: MyResponseItemData }) {
  const t = createTranslator(locale);
  const router = useRouter();
  const [withdrawn, setWithdrawn] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleWithdraw() {
    setBusy(true);
    const response = await fetch(`/api/responses/${item.id}/withdraw`, { method: "POST" });
    if (response.ok) {
      setWithdrawn(true);
      router.refresh();
    } else {
      setBusy(false);
    }
  }

  if (withdrawn) {
    return <li className={styles.item}>{t("me.my_responses.withdrawn_notice")}</li>;
  }

  return (
    <li className={styles.item}>
      <div className={styles.itemMain}>
        <span className={styles.itemTitle}>{item.requestTitle}</span>
        <span className={styles.itemMeta}>
          {item.organizationName} · {item.submittedAtLabel}
        </span>
        <Badge tone={mineResponseStatusTone(item.displayStatus)}>
          {t(`response.status.${item.displayStatus}`)}
        </Badge>
      </div>
      {item.canWithdraw ? (
        <Button variant="danger" onPress={handleWithdraw} isDisabled={busy}>
          {t("me.my_responses.withdraw_button")}
        </Button>
      ) : null}
    </li>
  );
}

export function MyResponsesList({
  locale,
  items,
}: {
  locale: SupportedLocale;
  items: MyResponseItemData[];
}) {
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <ResponseListItem key={item.id} locale={locale} item={item} />
      ))}
    </ul>
  );
}
