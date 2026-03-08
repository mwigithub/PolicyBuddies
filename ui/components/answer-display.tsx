"use client";

import { useState } from "react";
import { AskResponse } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle, ChevronDown } from "lucide-react";

interface AnswerDisplayProps {
  result: AskResponse;
  onFollowUp: () => void;
  onNewQuestion: () => void;
  loading?: boolean;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 80
      ? "var(--pb-success)"
      : pct >= 50
      ? "var(--pb-warning)"
      : "var(--pb-error)";
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full text-white"
      style={{ backgroundColor: color }}
    >
      ✓ Confidence: {pct}%
    </span>
  );
}

export function AnswerDisplay({ result, onFollowUp, onNewQuestion, loading }: AnswerDisplayProps) {
  const [sourcesExpanded, setSourcesExpanded] = useState(false);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Spinner size="md" className="text-[var(--pb-primary)]" />
        <div className="text-center">
          <p className="text-base text-gray-700 font-medium">Processing your question...</p>
          <p className="text-sm text-gray-500 mt-1">This typically takes a few seconds</p>
        </div>
      </div>
    );
  }

  if (!result.success) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-5 space-y-3">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-base font-semibold text-red-900">Unable to Process Question</p>
            <p className="text-sm text-red-700 mt-2 leading-relaxed">
              {result.error ?? "Something went wrong. Please try again."}
            </p>
          </div>
        </div>
        <p className="text-sm text-red-600 ml-8 bg-red-100/50 p-2.5 rounded">
          💡 Try rephrasing your question or check that documents are uploaded in the Admin panel.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Question</p>
          <p className="text-base text-gray-900 font-medium leading-relaxed">{result.question}</p>
        </div>
        {result.confidence != null && (
          <ConfidenceBadge confidence={result.confidence} />
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Answer</p>
        <p className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap font-medium">
          {result.answer}
        </p>
      </div>

      {result.sources && result.sources.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={() => setSourcesExpanded(!sourcesExpanded)}
            className="w-full flex items-center justify-between gap-2 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-200"
          >
            <span className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sources</span>
              <span className="text-xs font-medium text-gray-600 bg-white px-2 py-1 rounded">{result.sources.length}</span>
            </span>
            <ChevronDown 
              size={16} 
              className={`text-gray-400 transition-transform ${sourcesExpanded ? 'rotate-180' : ''}`}
            />
          </button>
          {sourcesExpanded && (
            <div className="space-y-2">
              {result.sources.map((src, i) => (
                <Card key={i} className="border border-gray-200 hover:border-blue-300 transition-colors">
                  <CardContent className="py-4 px-4">
                    <div className="flex items-start gap-3">
                      <span className="text-xl">📄</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {src.document ?? src.productName ?? "Policy Document"}
                        </p>
                        {(src.chunk ?? src.relevantText) && (
                          <p className="text-sm text-gray-600 mt-1.5 line-clamp-2 leading-relaxed">
                            &ldquo;{src.chunk ?? src.relevantText}&rdquo;
                          </p>
                        )}
                        {src.score != null && (
                          <p className="text-xs text-gray-500 mt-2 font-medium">
                            Relevance: {Math.round(src.score * 100)}%
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {result.reasoning?.detectedIntent && (
        <p className="text-xs text-gray-500 font-medium mt-3 pt-3 border-t border-gray-100">
          🧠 Intent: <span className="font-semibold">{result.reasoning.detectedIntent}</span>
          {result.reasoning.turnCount != null &&
            " · Turn " + result.reasoning.turnCount}
        </p>
      )}

      <div className="flex gap-2 pt-4 border-t border-gray-100">
        <Button
          variant="outline"
          size="sm"
          onClick={onFollowUp}
          className="text-[var(--pb-primary)] border-[var(--pb-primary)] font-medium"
        >
          Ask Follow-up
        </Button>
        <Button variant="ghost" size="sm" onClick={onNewQuestion} className="font-medium">
          New Question
        </Button>
      </div>
    </div>
  );
}
