"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, Send, Trash2 } from "lucide-react";
import { ChatMessage, type Message, type ToolEvent } from "./ChatMessage";
import { ChatSidebar } from "./ChatSidebar";
import { useLanguage } from "@/lib/i18n";
import {
  getSessions,
  upsertSession,
  deleteSession,
  deriveTitle,
  type ChatSession,
} from "@/lib/chat-storage";

const WELCOME: Message = {
  id: "0",
  role: "assistant",
  content:
    "Hello! I can answer questions about attendance, employees, catering costs, and the fleet. Try asking:\n\n- \"How many employees worked this week?\"\n- \"Show catering costs for June 2025\"\n- \"Which cars need maintenance?\"\n- \"Who used the most vacation days this year?\"",
  toolEvents: [],
  isStreaming: false,
};

function nextId() {
  return crypto.randomUUID();
}

export function ChatShell() {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>(() => getSessions());
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => crypto.randomUUID());
  const sessionCreatedAtRef = useRef(new Date().toISOString());
  const needsSaveRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!needsSaveRef.current) return;
    if (messages.some((m) => m.isStreaming)) return;
    needsSaveRef.current = false;

    const userMessages = messages.filter((m) => m.id !== "0");
    if (userMessages.length === 0) return;

    upsertSession({
      id: currentSessionId,
      title: deriveTitle(userMessages),
      createdAt: sessionCreatedAtRef.current,
      updatedAt: new Date().toISOString(),
      messages: userMessages.map((m) => ({ ...m, isStreaming: false })),
    });
    setSessions(getSessions());
  }, [messages, currentSessionId]);

  function startNewSession() {
    setCurrentSessionId(crypto.randomUUID());
    sessionCreatedAtRef.current = new Date().toISOString();
    setMessages([WELCOME]);
    setInput("");
    setError("");
  }

  function handleSelectSession(session: ChatSession) {
    setCurrentSessionId(session.id);
    sessionCreatedAtRef.current = session.createdAt;
    setMessages([WELCOME, ...session.messages.map((m) => ({ ...m, isStreaming: false }))]);
    setInput("");
    setError("");
  }

  function handleDeleteSession(id: string) {
    deleteSession(id);
    setSessions(getSessions());
    if (id === currentSessionId) startNewSession();
  }

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: Message = {
        id: nextId(),
        role: "user",
        content: text.trim(),
        toolEvents: [],
        isStreaming: false,
      };

      const assistantId = nextId();
      const assistantMsg: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        toolEvents: [],
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setIsLoading(true);
      setError("");

      const history = [...messages, userMsg]
        .filter((m) => m.id !== "0")
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));

              if (event.type === "text") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: m.content + event.delta } : m,
                  ),
                );
              } else if (event.type === "tool_start") {
                const toolEvent: ToolEvent = { tool: event.tool, status: "running" };
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, toolEvents: [...m.toolEvents, toolEvent] }
                      : m,
                  ),
                );
              } else if (event.type === "tool_result") {
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== assistantId) return m;
                    const toolEvents = m.toolEvents.map((te) =>
                      te.tool === event.tool && te.status === "running"
                        ? { ...te, status: "done" as const, preview: event.preview }
                        : te,
                    );
                    return { ...m, toolEvents };
                  }),
                );
              } else if (event.type === "done") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, isStreaming: false } : m,
                  ),
                );
              } else if (event.type === "error") {
                throw new Error(event.message);
              }
            } catch {
              // ignore individual SSE parse errors
            }
          }
        }
      } catch (err) {
        setError(String(err));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, isStreaming: false, content: m.content || "Something went wrong." }
              : m,
          ),
        );
      } finally {
        setIsLoading(false);
        needsSaveRef.current = true;
        inputRef.current?.focus();
      }
    },
    [messages, isLoading],
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] gap-4">
      {sidebarOpen && (
        <ChatSidebar
          sessions={sessions}
          currentId={currentSessionId}
          onSelect={handleSelectSession}
          onNew={startNewSession}
          onDelete={handleDeleteSession}
        />
      )}

      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 transition"
            title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          >
            {sidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1">
          {messages.map((m) => (
            <ChatMessage key={m.id} message={m} />
          ))}
          <div ref={bottomRef} />
        </div>

        {error && (
          <p className="text-xs text-red-600 mb-2 px-1">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2 pt-3 border-t border-slate-200 shrink-0">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("chatPlaceholder")}
            rows={2}
            disabled={isLoading}
            className="flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50"
          />
          <div className="flex flex-col gap-1">
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40 transition"
              title="Send"
            >
              <Send size={15} />
            </button>
            <button
              type="button"
              onClick={startNewSession}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-red-500 hover:border-red-200 transition"
              title="New chat"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </form>
        <p className="text-xs text-slate-400 mt-1.5 text-center shrink-0">
          {t("chatHint")}
        </p>
      </div>
    </div>
  );
}
