"use client";

import { useState, useEffect } from "react";
import { api, Document } from "@/lib/api";

export function useCatalog() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.catalog();
      setDocuments(res.documents ?? []);
    } catch {
      setError("Could not load documents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  return { documents, loading, error, refetch: fetch };
}
