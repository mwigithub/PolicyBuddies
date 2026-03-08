"use client";

import { useState, useCallback } from "react";
import { api, AskResponse } from "@/lib/api";

const SESSION_KEY = "pb_sessionId";
const HISTORY_KEY = "pb_recentQuestions";
const MAX_HISTORY = 10;

export interface ConversationTurn {
  question: string;
  answer: string;
  confidence: number;
  sources: AskResponse["sources"];
  timestamp: string;
}

function getSessionId(): string {
  if (typeof window === "undefined") return `session_${Date.now()}`;
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `session_${Date.now()}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function saveToHistory(question: string) {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem(HISTORY_KEY);
  const history: string[] = raw ? JSON.parse(raw) : [];
  const updated = [question, ...history.filter((q) => q !== question)].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
}

export function getHistory(): string[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(HISTORY_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function useAsk() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const ask = useCallback(async (question: string, keepSession = false, productFilter?: string) => {
    setLoading(true);
    setError(null);

    if (!keepSession) {
      const newId = `session_${Date.now()}`;
      if (typeof window !== "undefined") localStorage.setItem(SESSION_KEY, newId);
    }

    const sessionId = getSessionId();
    saveToHistory(question);
    setHistory(getHistory());

    try {
      const res = await api.ask(question, sessionId, 3, productFilter);
      setResult(res);
      if (!res.success) setError(res.error ?? "Something went wrong.");
    } catch (e) {
      setError("Could not reach the API. Is the server running?");
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    if (typeof window !== "undefined") {
      const newId = `session_${Date.now()}`;
      localStorage.setItem(SESSION_KEY, newId);
    }
  }, []);

  return { ask, reset, loading, error, result, history };
}
