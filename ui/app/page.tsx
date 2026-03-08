"use client";

import { useState, useEffect } from "react";
import { Search, Lightbulb, Clock, ArrowRight, Shield, FileText, Coins, Sparkles } from "lucide-react";
import { useAsk } from "@/hooks/use-ask";
import { useCatalog } from "@/hooks/use-catalog";
import { AnswerDisplay } from "@/components/answer-display";
import { ClarificationDialog } from "@/components/clarification-dialog";

const EXAMPLE_QUESTIONS = {
  Coverage: {
    icon: Shield,
    gradient: "from-blue-500 to-blue-600",
    light: "bg-blue-50 border-blue-100",
    tag: "text-blue-600 bg-blue-100",
    hover: "hover:border-blue-300 hover:bg-blue-50/80",
    questions: [
      "What is covered under my medical insurance?",
      "Does my policy cover dental and vision?",
      "What are the exclusions in my policy?",
    ],
  },
  Claims: {
    icon: FileText,
    gradient: "from-emerald-500 to-emerald-600",
    light: "bg-emerald-50 border-emerald-100",
    tag: "text-emerald-600 bg-emerald-100",
    hover: "hover:border-emerald-300 hover:bg-emerald-50/80",
    questions: [
      "How do I file a claim?",
      "What documents do I need for a claim?",
      "How long does claim processing take?",
    ],
  },
  Premiums: {
    icon: Coins,
    gradient: "from-violet-500 to-violet-600",
    light: "bg-violet-50 border-violet-100",
    tag: "text-violet-600 bg-violet-100",
    hover: "hover:border-violet-300 hover:bg-violet-50/80",
    questions: [
      "What is the minimum premium I need to pay?",
      "Can I change my premium payment schedule?",
      "What happens if I miss a premium payment?",
    ],
  },
};

const HELPFUL_TIPS = [
  "Ask specific questions for more accurate answers",
  "Mention product names when asking about specific policies",
  "You can ask follow-up questions for clarification",
  "Source documents are shown alongside each answer",
];

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

export default function HomePage() {
  const { ask, reset, loading, error, result } = useAsk();
  const { documents } = useCatalog();
  const [question, setQuestion] = useState("");
  const [product, setProduct] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [history, setHistory] = useState<{ question: string; time: string }[]>([]);
  const [activeHistoryItem, setActiveHistoryItem] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const raw = localStorage.getItem("pb_recentQuestions");
    if (raw) {
      const items: string[] = JSON.parse(raw);
      setHistory(
        items.map((q) => ({
          question: q,
          time: new Date(Date.now() - Math.random() * 86400000 * 3).toISOString(),
        }))
      );
    }
  }, [loading]);

  const productOptions = Array.from(new Set(documents.map((d) => d.productName).filter(Boolean) as string[]));
  
  // Set first product as default when products load
  useEffect(() => {
    if (productOptions.length > 0 && !product) {
      setProduct(productOptions[0]);
    }
  }, [productOptions]);

  const handleAsk = async (q: string, keepSession = false) => {
    if (!q.trim() || !product || loading) return;
    setShowAnswer(false);
    await ask(q, keepSession, product);
    setShowAnswer(true);
  };

  const handleNewQuestion = () => {
    reset();
    setShowAnswer(false);
    setQuestion("");
    setActiveHistoryItem(null);
  };

  const needsClarification =
    showAnswer &&
    result?.reasoning?.clarificationNeeded &&
    (result.reasoning.clarificationQuestions?.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8FAFC] to-white">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">

        {/* Two-column layout: Input + Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">

          {/* Left: Input card (3/5) */}
          <div className="col-span-1 lg:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <span>💬</span>
                  Ask a Question
                </h2>
              </div>
            </div>

            {/* Product filter */}
            <div className="space-y-1.5">
              <label className="text-base font-semibold text-gray-700 block uppercase tracking-wide">
                Filter <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 text-base text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                >
                  <option value="">Select a product...</option>
                  {productOptions.map((p) => <option key={p}>{p}</option>)}
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Textarea */}
            <div className="space-y-2">
              <label className="text-base font-semibold text-gray-700 block uppercase tracking-wide">Question</label>
              <div className="relative">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAsk(question); }}
                  placeholder="e.g. What are the exclusions? What happens if I miss a payment?"
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-lg text-gray-800 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  disabled={loading}
                />
                <Search size={16} className="absolute right-4 top-3 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Button */}
            <button
              onClick={() => handleAsk(question)}
              disabled={!question.trim() || !product || loading}
              className="w-full flex items-center justify-center gap-2 py-3 h-12 rounded-lg text-base font-semibold transition-all disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed active:scale-[0.99]"
              style={question.trim() && product && !loading ? { backgroundColor: "#0066CC", color: "white" } : {}}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Thinking...
                </>
              ) : (
                <>
                  Ask Question
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            {/* Answer */}
            {showAnswer && result && !needsClarification && (
              <div className="border-t border-gray-100 pt-5">
                <AnswerDisplay
                  result={result}
                  loading={loading}
                  onFollowUp={() => { setShowAnswer(false); setQuestion(""); }}
                  onNewQuestion={handleNewQuestion}
                />
              </div>
            )}

            {error && !showAnswer && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
            )}
          </div>

          {/* Right: Tips + History sidebar (2/5) */}
          <div className="col-span-2 space-y-5">

            {/* Recent Questions */}
            {history.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <span>⏱️</span>
                  Recent
                </h3>
                <div className="space-y-1.5">
                  {history.slice(0, 5).map((item, i) => (
                    <button
                      key={i}
                      onClick={() => { setActiveHistoryItem(item.question); setQuestion(item.question); }}
                      className={`w-full text-left px-3.5 py-3 rounded-xl border text-sm leading-relaxed transition-all ${
                        activeHistoryItem === item.question
                          ? "border-blue-300 bg-blue-50 text-blue-700"
                          : "border-gray-100 hover:border-blue-200 hover:bg-gray-50 text-gray-700"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium leading-snug line-clamp-2">{item.question}</span>
                        <span className="text-xs text-gray-400 shrink-0 mt-0.5" suppressHydrationWarning>
                          {isClient ? relativeTime(item.time) : ""}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Helpful Tips */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <span>💡</span>
                Tips
              </h3>
              <ul className="space-y-2.5">
                {HELPFUL_TIPS.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-base leading-relaxed text-gray-700">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0 flex-shrink-0">{i + 1}</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>

        {/* Example Questions */}
        <div className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2 tracking-tight">
            <span>✨</span>
            Try These Questions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(EXAMPLE_QUESTIONS).map(([category, { icon: Icon, gradient, light, tag, hover, questions }]) => (
              <div key={category} className={`rounded-xl border ${light} p-4 space-y-2.5`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm`}>
                    <Icon size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900">{category}</p>
                    <span className={`text-sm px-2 py-0.5 rounded-full ${tag}`}>{questions.length}</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {questions.map((q) => (
                    <button
                      key={q}
                      onClick={() => setQuestion(q)}
                      className={`w-full text-left text-base text-gray-700 bg-white border border-gray-100 rounded-lg px-3 py-2 transition-all ${hover} group flex items-start justify-between gap-2`}
                    >
                      <span className="leading-snug">{q}</span>
                      <ArrowRight size={13} className="text-gray-300 group-hover:text-gray-500 mt-0.5 shrink-0 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Clarification dialog */}
      {needsClarification && result?.reasoning?.clarificationQuestions && (
        <ClarificationDialog
          open={true}
          questions={result.reasoning.clarificationQuestions}
          onConfirm={(answer) => handleAsk(answer, true)}
          onCancel={() => setShowAnswer(false)}
        />
      )}
    </div>
  );
}
