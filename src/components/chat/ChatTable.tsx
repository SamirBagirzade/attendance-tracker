import type { ComponentProps } from "react";

export function ChatTable({ children }: ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto my-3 rounded border border-slate-200">
      <table className="min-w-full text-sm">{children}</table>
    </div>
  );
}

export function ChatThead({ children }: ComponentProps<"thead">) {
  return <thead className="bg-slate-50 text-slate-600 text-xs uppercase">{children}</thead>;
}

export function ChatTbody({ children }: ComponentProps<"tbody">) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>;
}

export function ChatTh({ children }: ComponentProps<"th">) {
  return <th className="px-3 py-2 text-left font-medium whitespace-nowrap">{children}</th>;
}

export function ChatTd({ children }: ComponentProps<"td">) {
  return <td className="px-3 py-2 whitespace-nowrap">{children}</td>;
}
