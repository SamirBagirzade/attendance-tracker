"use client";

import ReactMarkdown from "react-markdown";
import { CheckCircle, Loader2 } from "lucide-react";
import { ChatTable, ChatThead, ChatTbody, ChatTh, ChatTd } from "./ChatTable";

export type ToolEvent = {
  tool: string;
  status: "running" | "done";
  preview?: string;
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolEvents: ToolEvent[];
  isStreaming: boolean;
};

const TOOL_LABELS: Record<string, string> = {
  get_attendance_summary: "Attendance data",
  get_employees: "Employee list",
  get_dashboard: "Today's dashboard",
  get_employee_absences: "Leave balances",
  get_cook_report: "Catering report",
  get_car_status: "Fleet status",
};

function ToolBadge({ event }: { event: ToolEvent }) {
  const label = TOOL_LABELS[event.tool] ?? event.tool;
  return (
    <div className="flex items-center gap-1.5 mb-2 text-xs text-slate-500">
      {event.status === "running" ? (
        <Loader2 size={12} className="animate-spin text-slate-400" />
      ) : (
        <CheckCircle size={12} className="text-green-500" />
      )}
      <span>{event.status === "running" ? `Querying ${label}…` : label}</span>
      {event.status === "done" && event.preview && (
        <span className="text-slate-400">· {event.preview}</span>
      )}
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex gap-1 items-center h-5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

export function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%] bg-slate-900 text-white text-sm whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-tl-sm px-4 py-3 max-w-[90%] bg-white border border-slate-200 text-sm text-slate-800 shadow-sm">
        {message.toolEvents.map((ev, i) => (
          <ToolBadge key={i} event={ev} />
        ))}

        {message.isStreaming && !message.content ? (
          <ThinkingDots />
        ) : (
          <div className="[&_p]:my-1 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:my-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:my-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5 [&_strong]:font-semibold [&_code]:bg-slate-100 [&_code]:rounded [&_code]:px-1 [&_code]:text-xs [&_pre]:bg-slate-100 [&_pre]:rounded [&_pre]:p-2 [&_pre]:text-xs [&_pre]:overflow-x-auto [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:text-slate-600">
            <ReactMarkdown
              components={{
                table: ChatTable,
                thead: ChatThead,
                tbody: ChatTbody,
                th: ChatTh,
                td: ChatTd,
              }}
            >
              {message.content}
            </ReactMarkdown>
            {message.isStreaming && (
              <span className="inline-block w-0.5 h-4 bg-slate-600 animate-pulse ml-0.5 align-middle" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
