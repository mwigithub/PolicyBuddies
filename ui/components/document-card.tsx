import { Document } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";

interface DocumentCardProps {
  doc: Document;
}

const jurisdictionFlag: Record<string, string> = {
  SG: "🇸🇬",
  MY: "🇲🇾",
  AU: "🇦🇺",
  US: "🇺🇸",
  GB: "🇬🇧",
};

export function DocumentCard({ doc }: DocumentCardProps) {
  const flag = doc.jurisdiction ? (jurisdictionFlag[doc.jurisdiction] ?? doc.jurisdiction) : "";

  const indexedDate = doc.indexedAt
    ? new Date(doc.indexedAt).toLocaleDateString("en-SG", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

  return (
    <Card className="border border-gray-200 hover:border-[var(--pb-primary)] transition-colors">
      <CardContent className="py-4 px-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-gray-900">
                {doc.productName ?? doc.sourcePath ?? "Unnamed Document"}
              </p>
              {doc.versionLabel && (
                <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                  {doc.versionLabel}
                </span>
              )}
              {flag && <span className="text-sm">{flag}</span>}
            </div>
            {doc.documentType && (
              <p className="text-xs text-gray-400 mt-0.5">{doc.documentType}</p>
            )}
          </div>
        </div>

        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
          {(doc.chunkCount ?? doc.vectorCount) != null && (
            <span>
              {doc.chunkCount ?? doc.vectorCount} chunks
            </span>
          )}
          <span>Indexed: {indexedDate}</span>
        </div>
      </CardContent>
    </Card>
  );
}
