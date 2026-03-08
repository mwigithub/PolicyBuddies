"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getHistory } from "@/hooks/use-ask";

interface QuestionInputProps {
  onAsk: (question: string) => void;
  loading: boolean;
  onSelectHistory?: (q: string) => void;
}

export function QuestionInput({ onAsk, loading, onSelectHistory }: QuestionInputProps) {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    setHistory(getHistory());
  }, [loading]);

  const handleSubmit = () => {
    const q = question.trim();
    if (!q || loading) return;
    onAsk(q);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
  };

  return (
    <div className="space-y-4">
      <div className="text-center py-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Ask about your insurance policies
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Get instant AI-powered answers from your policy documents
        </p>
      </div>

      <div className="space-y-2">
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What would you like to know? e.g. What is the coverage limit?"
          className="min-h-[100px] text-sm resize-none focus:border-[var(--pb-primary)]"
          disabled={loading}
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">Press ⌘↵ or click Ask</p>
          <Button
            onClick={handleSubmit}
            disabled={!question.trim() || loading}
            style={{ backgroundColor: "var(--pb-primary)" }}
            className="text-white hover:opacity-90"
          >
            {loading ? "Thinking..." : "Ask Question"}
          </Button>
        </div>
      </div>

      {history.length > 0 && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            Recent Questions
          </p>
          <ul className="space-y-1">
            {history.map((q, i) => (
              <li key={i}>
                <button
                  onClick={() => {
                    setQuestion(q);
                    onSelectHistory?.(q);
                  }}
                  className="text-sm text-left text-gray-600 hover:text-[var(--pb-primary)] w-full truncate transition-colors"
                >
                  • {q}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
