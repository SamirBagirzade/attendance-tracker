"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Paperclip, Plus, Trash2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

type Doc = {
  id: number;
  name: string;
  filename: string;
  size: number;
  uploadedAt: string;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentsSection({ carId, employeeId }: { carId?: number; employeeId?: number }) {
  const { t } = useLanguage();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const listUrl = carId
    ? `/api/cars/${carId}/documents`
    : `/api/employees/${employeeId}/documents`;

  useEffect(() => {
    setListLoading(true);
    fetch(listUrl)
      .then((r) => r.json())
      .then((data) => setDocs(data.documents ?? []))
      .catch(() => {})
      .finally(() => setListLoading(false));
  }, [listUrl]);

  async function upload() {
    if (!name.trim() || !file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("file", file);
      if (carId) fd.append("carId", String(carId));
      if (employeeId) fd.append("employeeId", String(employeeId));

      const res = await fetch("/api/documents", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setDocs((prev) => [json.document, ...prev]);
      setName("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(String(err));
    } finally {
      setUploading(false);
    }
  }

  async function deleteDoc(id: number) {
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) setDocs((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <div className="mt-5 pt-5 border-t border-slate-200">
      <div className="flex items-center gap-2 mb-3">
        <Paperclip size={14} className="text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-700">{t("documents")}</h3>
      </div>

      {/* Upload form */}
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("documentName")}
          className="h-9 rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 w-40"
        />
        <input
          ref={fileRef}
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
        />
        <button
          onClick={() => void upload()}
          disabled={uploading || !name.trim() || !file}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-slate-800 px-3 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40 transition"
        >
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          {t("uploadFile")}
        </button>
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      {listLoading ? (
        <p className="text-xs text-slate-400">{t("loading")}…</p>
      ) : docs.length === 0 ? (
        <p className="text-xs text-slate-400">{t("noDocuments")}</p>
      ) : (
        <div className="space-y-1.5">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <Paperclip size={13} className="text-slate-400 shrink-0" />
              <span className="text-sm font-semibold text-slate-800 min-w-[80px]">{doc.name}</span>
              <span className="text-xs text-slate-500 flex-1 truncate">{doc.filename}</span>
              <span className="text-xs text-slate-400 shrink-0">{formatSize(doc.size)}</span>
              <a
                href={`/api/documents/${doc.id}`}
                className="h-7 w-7 inline-flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 transition"
                title={t("downloadFile")}
              >
                <Download size={12} />
              </a>
              <button
                onClick={() => void deleteDoc(doc.id)}
                className="h-7 w-7 inline-flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:text-red-500 hover:border-red-200 transition"
                title={t("delete")}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
