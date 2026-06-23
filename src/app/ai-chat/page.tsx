"use client";

import { AppShell } from "@/components/AppShell";
import { ChatShell } from "@/components/chat/ChatShell";
import { useLanguage } from "@/lib/i18n";

export default function AiChatPage() {
  const { t } = useLanguage();
  return (
    <AppShell title={t("aiChat")} eyebrow={t("attendanceTracker")}>
      <ChatShell />
    </AppShell>
  );
}
