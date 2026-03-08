const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export interface Document {
  id: string;
  sourcePath?: string;
  productName?: string;
  planName?: string;
  insurer?: string;
  insuranceType?: string;
  jurisdiction?: string;
  versionLabel?: string;
  documentType?: string;
  indexedAt?: string;
  chunkCount?: number;
  vectorCount?: number;
  status?: string;
}

export interface Source {
  document?: string;
  chunk?: number;
  score?: number;
  productName?: string;
  relevantText?: string;
}

export interface AskResponse {
  success: boolean;
  question: string;
  answer?: string;
  confidence?: number;
  sources?: Source[];
  reasoning?: {
    detectedIntent?: string;
    clarificationNeeded?: boolean;
    clarificationQuestions?: string[];
    turnCount?: number;
  };
  orchestration?: {
    status?: string;
    finalizedAt?: string;
  };
  error?: string;
}

export interface CatalogResponse {
  success: boolean;
  documentCount: number;
  documents: Document[];
}

export interface IngestResponse {
  success: boolean;
  runId?: string;
  documentVersionId?: string;
  chunksGenerated?: number;
  vectorsStored?: number;
  error?: string;
}

export interface IngestMetadata {
  insurer: string;
  planName: string;
  jurisdiction: string;
  insuranceType: string;
  versionLabel: string;
  documentType: string;
}

export interface TaxonomyItem {
  label: string;
  value: string;
}

export interface Taxonomy {
  insurers: TaxonomyItem[];
  jurisdictions: string[];
  insuranceTypes: TaxonomyItem[];
  documentTypes: TaxonomyItem[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const data = await res.json();
  return data as T;
}

export const api = {
  ask(question: string, sessionId?: string, topK = 3, productFilter?: string): Promise<AskResponse> {
    return request<AskResponse>("/api/ask", {
      method: "POST",
      body: JSON.stringify({ question, sessionId, topK, productFilter }),
    });
  },

  catalog(): Promise<CatalogResponse> {
    return request<CatalogResponse>("/api/catalog");
  },

  taxonomy(): Promise<Taxonomy> {
    return request<Taxonomy>("/api/taxonomy");
  },

  ingest(filename: string, content: string, metadata: IngestMetadata): Promise<IngestResponse> {
    return request<IngestResponse>("/api/ingest", {
      method: "POST",
      body: JSON.stringify({ filename, content, metadata }),
    });
  },

  deleteDocument(id: string): Promise<{ success: boolean; error?: string }> {
    return request("/api/documents/" + id, { method: "DELETE" });
  },

  reindexDocument(id: string): Promise<{ success: boolean; chunksGenerated?: number; vectorsStored?: number; error?: string }> {
    return request("/api/reindex/" + id, { method: "POST" });
  },

  health(): Promise<{ status: string }> {
    return request<{ status: string }>("/api/health");
  },
};
