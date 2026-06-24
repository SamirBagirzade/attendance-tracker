import type { Message } from "@/components/chat/ChatMessage";

const STORAGE_KEY = "chat_sessions_v1";
const MAX_SESSIONS = 30;

export type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
};

function load(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChatSession[]) : [];
  } catch {
    return [];
  }
}

function persist(sessions: ChatSession[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
  } catch {
    // quota exceeded
  }
}

export function getSessions(): ChatSession[] {
  return load().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function upsertSession(session: ChatSession): void {
  const all = load().filter((s) => s.id !== session.id);
  all.unshift(session);
  persist(all);
}

export function deleteSession(id: string): void {
  persist(load().filter((s) => s.id !== id));
}

export function deriveTitle(messages: Message[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first?.content) return "New chat";
  const text = first.content.trim();
  return text.length > 48 ? text.slice(0, 48) + "…" : text;
}
