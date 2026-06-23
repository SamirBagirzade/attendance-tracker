"use client";

import { MessageSquare, Plus, Trash2 } from "lucide-react";
import type { ChatSession } from "@/lib/chat-storage";

function formatDate(iso: string): string {
  const d = new Date(iso);
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ChatSidebar({
  sessions,
  currentId,
  onSelect,
  onNew,
  onDelete,
}: {
  sessions: ChatSession[];
  currentId: string;
  onSelect: (s: ChatSession) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex flex-col w-56 shrink-0 border-r border-slate-200 pr-3 gap-2 overflow-hidden">
      <button
        onClick={onNew}
        className="flex items-center gap-2 w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition shrink-0"
      >
        <Plus size={14} />
        New chat
      </button>

      <div className="flex-1 overflow-y-auto space-y-0.5 -mr-1 pr-1">
        {sessions.length === 0 ? (
          <p className="text-xs text-slate-400 px-2 py-3 text-center">No saved chats</p>
        ) : (
          sessions.map((s) => {
            const active = s.id === currentId;
            return (
              <div
                key={s.id}
                onClick={() => onSelect(s)}
                className={`group flex items-start gap-1.5 rounded-md px-2 py-2 cursor-pointer transition ${
                  active
                    ? "bg-slate-900 text-white"
                    : "hover:bg-slate-100 text-slate-700"
                }`}
              >
                <MessageSquare size={12} className="mt-0.5 shrink-0 opacity-50" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium leading-tight line-clamp-2 break-words">
                    {s.title}
                  </p>
                  <p className="text-[10px] mt-0.5 text-slate-400">
                    {formatDate(s.updatedAt)}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(s.id);
                  }}
                  className={`shrink-0 opacity-0 group-hover:opacity-100 transition rounded p-0.5 mt-0.5 ${
                    active
                      ? "hover:bg-slate-700 text-slate-300"
                      : "hover:bg-slate-200 text-slate-500"
                  }`}
                  title="Delete chat"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
