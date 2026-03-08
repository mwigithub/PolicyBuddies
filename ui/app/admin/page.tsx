"use client";

import { useState } from "react";
import { FileText, BarChart2, Upload, RefreshCw, Trash2, Building2, ChevronDown, ChevronRight } from "lucide-react";
import { UploadForm } from "@/components/upload-form";
import { useCatalog } from "@/hooks/use-catalog";
import { Document, api } from "@/lib/api";

const jurisdictionFlag: Record<string, string> = {
  SG: "🇸🇬", MY: "🇲🇾", AU: "🇦🇺", US: "🇺🇸", GB: "🇬🇧",
};

const insurerLabel: Record<string, string> = {
  "tokio-marine-life": "Tokio Marine Life",
  "aia": "AIA",
  "prudential": "Prudential",
  "great-eastern": "Great Eastern",
};

const insuranceTypeLabel: Record<string, string> = {
  "investment-linked": "Investment-Linked",
  "term-life": "Term Life",
  "whole-life": "Whole Life",
  "endowment": "Endowment",
  "annuity": "Annuity",
  "health": "Health",
};

const docTypeLabel: Record<string, string> = {
  "product-summary": "Product Summary",
  "policy-illustration": "Policy Illustration",
  "policy-wording": "Policy Wording",
  "benefit-schedule": "Benefit Schedule",
  "brochure": "Brochure",
};

function relativeTime(iso?: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return "Today";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return "Today";
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function StatCard({ icon, iconBg, label, value }: { icon: React.ReactNode; iconBg: string; label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${iconBg}`}>{icon}</div>
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900 tracking-tight">{value}</p>
    </div>
  );
}

function DocRow({ doc, onRefetch }: { doc: Document; onRefetch: () => void }) {
  const [reindexing, setReindexing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  const handleReindex = async () => {
    setReindexing(true);
    setActionMsg("");
    try {
      const res = await api.reindexDocument(doc.id);
      if (res.success) { setActionMsg(`${res.chunksGenerated ?? 0} chunks`); onRefetch(); }
      else setActionMsg(res.error ?? "Reindex failed");
    } catch { setActionMsg("API error"); }
    finally { setReindexing(false); }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${doc.planName ?? doc.productName}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await api.deleteDocument(doc.id);
      if (res.success) { onRefetch(); }
      else { setActionMsg(res.error ?? "Delete failed"); setDeleting(false); }
    } catch { setActionMsg("API error"); setDeleting(false); }
  };

  const filename = doc.sourcePath?.split("/").pop() ?? "";
  const dtLabel = docTypeLabel[doc.documentType ?? ""] ?? doc.documentType ?? "—";

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50 rounded-lg group">
      <div className="flex items-center gap-3 min-w-0">
        <FileText size={15} className="text-[#2563EB] shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900 truncate">
              {doc.planName ?? doc.productName ?? "Unnamed"}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
              {dtLabel}
            </span>
            {doc.versionLabel && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-gray-200 text-gray-400 shrink-0">
                {doc.versionLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {filename && <span className="text-xs text-gray-400 truncate">{filename}</span>}
            <span className="text-xs text-gray-400">
              {doc.chunkCount != null && <><strong>{doc.chunkCount}</strong> chunks · </>}
              {relativeTime(doc.indexedAt)}
            </span>
            {actionMsg && <span className="text-xs text-amber-600">{actionMsg}</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleReindex}
          disabled={reindexing || deleting}
          className="flex items-center gap-1 text-xs text-gray-500 border border-gray-200 rounded-md px-2.5 py-1 hover:bg-gray-100 disabled:opacity-40 transition-colors"
        >
          <RefreshCw size={11} className={reindexing ? "animate-spin" : ""} />
          {reindexing ? "Reindexing…" : "Reindex"}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting || reindexing}
          className="flex items-center gap-1 text-xs text-red-500 border border-red-200 rounded-md px-2.5 py-1 hover:bg-red-50 disabled:opacity-40 transition-colors"
        >
          <Trash2 size={11} />
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}

function GroupSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
          <span className="text-sm font-semibold text-gray-800">{title}</span>
          <span className="text-xs text-gray-400">({count})</span>
        </div>
      </button>
      {open && <div className="bg-white divide-y divide-gray-50 px-2 py-1">{children}</div>}
    </div>
  );
}

export default function AdminPage() {
  const { documents, loading, error, refetch } = useCatalog();
  const [showUpload, setShowUpload] = useState(false);

  const totalChunks = documents.reduce((sum, d) => sum + (d.chunkCount ?? 0), 0);
  const totalVectors = documents.reduce((sum, d) => sum + (d.vectorCount ?? d.chunkCount ?? 0), 0);
  const uniqueInsurers = new Set(documents.map((d) => d.insurer).filter(Boolean)).size;

  // Group: insurer → jurisdiction → insuranceType
  type Group = Record<string, Record<string, Record<string, Document[]>>>;
  const grouped = documents.reduce<Group>((acc, doc) => {
    const ins = doc.insurer ?? "other";
    const jur = doc.jurisdiction ?? "Other";
    const typ = doc.insuranceType ?? "other";
    if (!acc[ins]) acc[ins] = {};
    if (!acc[ins][jur]) acc[ins][jur] = {};
    if (!acc[ins][jur][typ]) acc[ins][jur][typ] = [];
    acc[ins][jur][typ].push(doc);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>📄</span>
              Documents
            </h1>
            <p className="text-base sm:text-lg text-gray-600 mt-1">Upload and organize policy documents</p>
          </div>
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="flex items-center justify-center sm:justify-start gap-2 w-full sm:w-auto px-4 py-3 rounded-lg text-base font-semibold text-white bg-[#0066CC] hover:bg-[#0052A3] transition-colors"
          >
            <Upload size={16} />
            Upload
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard icon={<Building2 size={18} className="text-violet-500" />} iconBg="bg-violet-50" label="Insurers" value={uniqueInsurers} />
          <StatCard icon={<FileText size={18} className="text-[#2563EB]" />} iconBg="bg-blue-50" label="Documents" value={documents.length} />
          <StatCard icon={<BarChart2 size={18} className="text-green-500" />} iconBg="bg-green-50" label="Chunks" value={totalChunks} />
          <StatCard icon={<BarChart2 size={18} className="text-amber-500" />} iconBg="bg-amber-50" label="Vectors" value={totalVectors} />
        </div>

        {/* Upload panel */}
        {showUpload && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-xl font-bold text-gray-900 mb-5 tracking-tight">Upload New Document</h3>
            <UploadForm onSuccess={() => { refetch(); setShowUpload(false); }} />
          </div>
        )}

        {/* Error */}
        {error && <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>}

        {/* Loading */}
        {loading && <div className="text-sm text-gray-400 py-4 text-center">Loading documents…</div>}

        {/* Empty state */}
        {!loading && documents.length === 0 && !error && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            <p className="text-4xl mb-3">📄</p>
            <p className="text-sm font-medium">No documents yet</p>
            <p className="text-xs mt-1">Upload your first PDF to get started</p>
          </div>
        )}

        {/* Grouped hierarchy */}
        {!loading && Object.entries(grouped).map(([insurer, byJurisdiction]) => (
          <GroupSection
            key={insurer}
            title={insurerLabel[insurer] ?? insurer}
            count={Object.values(byJurisdiction).flatMap(Object.values).flatMap(x => x).length}
          >
            {Object.entries(byJurisdiction).map(([jur, byType]) => (
              Object.entries(byType).map(([typ, docs]) => (
                <GroupSection
                  key={`${jur}-${typ}`}
                  title={`${jurisdictionFlag[jur] ?? ""} ${jur} · ${insuranceTypeLabel[typ] ?? typ}`}
                  count={docs.length}
                >
                  {docs.map((doc) => (
                    <DocRow key={doc.id} doc={doc} onRefetch={refetch} />
                  ))}
                </GroupSection>
              ))
            ))}
          </GroupSection>
        ))}

      </div>
    </div>
  );
}
