"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { api, Taxonomy } from "@/lib/api";

interface Props {
  onSuccess?: () => void;
}

const EMPTY = { insurer: "", planName: "", jurisdiction: "", insuranceType: "", documentType: "", versionLabel: "v1.0" };

export function UploadForm({ onSuccess }: Props) {
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [fields, setFields] = useState(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.taxonomy().then(setTaxonomy).catch(() => setMessage("Failed to load taxonomy"));
  }, []);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFields((prev) => ({ ...prev, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setStatus("uploading");
    setMessage("");

    try {
      const isPdf = file.name.toLowerCase().endsWith(".pdf");
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        if (isPdf) {
          reader.onload = (e) => {
            const arr = e.target?.result as ArrayBuffer;
            const bytes = new Uint8Array(arr);
            let binary = "";
            for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
            resolve(btoa(binary));
          };
          reader.readAsArrayBuffer(file);
        } else {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsText(file);
        }
        reader.onerror = reject;
      });

      const result = await api.ingest(file.name, content, {
        insurer: fields.insurer,
        planName: fields.planName,
        jurisdiction: fields.jurisdiction,
        insuranceType: fields.insuranceType,
        documentType: fields.documentType,
        versionLabel: fields.versionLabel || "v1.0",
      });

      if (result.success) {
        setStatus("success");
        setMessage(`Indexed ${result.chunksGenerated ?? 0} chunks`);
        setFields(EMPTY);
        setFile(null);
        if (fileRef.current) fileRef.current.value = "";
        onSuccess?.();
      } else {
        setStatus("error");
        setMessage(result.error ?? "Upload failed");
      }
    } catch {
      setStatus("error");
      setMessage("Network error — check API connection");
    }
  }

  const selectField = (label: string, key: keyof typeof EMPTY, options: { label: string; value: string }[]) => (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-700">{label} <span className="text-red-500">*</span></label>
      <select
        value={fields[key]}
        onChange={set(key)}
        required
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
      >
        <option value="">Select…</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* File picker */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Document File <span className="text-red-500">*</span></label>
        <div
          className="flex items-center gap-3 rounded-lg border-2 border-dashed border-gray-200 px-4 py-4 cursor-pointer hover:border-[#2563EB] transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={18} className="text-gray-400 shrink-0" />
          <span className="text-sm text-gray-500 truncate">
            {file ? file.name : "Click to select PDF, TXT, or MD"}
          </span>
          {file && (
            <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); if (fileRef.current) fileRef.current.value = ""; }}
              className="ml-auto text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".pdf,.txt,.md" className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>

      {/* Taxonomy dropdowns */}
      {!taxonomy ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
          <Loader2 size={14} className="animate-spin" /> Loading options…
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {selectField("Insurer", "insurer", taxonomy.insurers)}
          {selectField("Jurisdiction", "jurisdiction", taxonomy.jurisdictions.map((j) => ({ label: j, value: j })))}
          {selectField("Insurance Type", "insuranceType", taxonomy.insuranceTypes)}
          {selectField("Document Type", "documentType", taxonomy.documentTypes)}
        </div>
      )}

      {/* Plan name + version */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Plan Name <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={fields.planName}
            onChange={set("planName")}
            placeholder="e.g. Wealth Pro II"
            required
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Version</label>
          <input
            type="text"
            value={fields.versionLabel}
            onChange={set("versionLabel")}
            placeholder="v1.0"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
          />
        </div>
      </div>

      {/* Status */}
      {status === "success" && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <CheckCircle size={15} /> {message}
        </div>
      )}
      {status === "error" && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle size={15} /> {message}
        </div>
      )}

      <button
        type="submit"
        disabled={!file || !fields.insurer || !fields.planName || !fields.jurisdiction || !fields.insuranceType || !fields.documentType || status === "uploading"}
        className="w-full rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
      >
        {status === "uploading" ? <><Loader2 size={15} className="animate-spin" /> Uploading…</> : "Upload Document"}
      </button>
    </form>
  );
}
