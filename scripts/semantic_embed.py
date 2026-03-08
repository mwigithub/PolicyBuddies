#!/usr/bin/env python3
"""
Semantic embedding and reranking using sentence-transformers.

Modes:
  embed-batch  Embed a batch of texts, return vectors as JSON
  rerank       Score a list of chunk texts against a question using cosine similarity

Usage:
  python3 scripts/semantic_embed.py embed-batch --texts '["text1", "text2"]'
  python3 scripts/semantic_embed.py rerank --question "..." --chunks '["chunk1", "chunk2"]'
"""

import sys
import json
import argparse

import numpy as np
from sentence_transformers import SentenceTransformer

DEFAULT_MODEL = "all-MiniLM-L6-v2"


def cosine_similarity(a, b):
    a = np.array(a, dtype=np.float32)
    b = np.array(b, dtype=np.float32)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["embed-batch", "rerank"])
    parser.add_argument("--texts", type=str, help="JSON array of texts (embed-batch mode)")
    parser.add_argument("--question", type=str, help="Question text (rerank mode)")
    parser.add_argument("--chunks", type=str, help="JSON array of chunk texts (rerank mode)")
    parser.add_argument("--model", type=str, default=DEFAULT_MODEL)
    args = parser.parse_args()

    model = SentenceTransformer(args.model)

    if args.mode == "embed-batch":
        # Read texts from stdin (preferred — avoids E2BIG) or fall back to --texts arg
        if args.texts:
            texts = json.loads(args.texts)
        else:
            texts = json.loads(sys.stdin.read())
        embeddings = model.encode(texts, convert_to_numpy=True).tolist()
        print(json.dumps({"ok": True, "embeddings": embeddings, "dims": len(embeddings[0]) if embeddings else 0}))

    elif args.mode == "rerank":
        if args.question and args.chunks:
            question = args.question
            chunks = json.loads(args.chunks)
        else:
            payload = json.loads(sys.stdin.read())
            question = payload["question"]
            chunks = payload["chunks"]
        if not chunks:
            print(json.dumps({"ok": True, "scores": []}))
            return
        # Encode question + all chunks in one batch for efficiency
        all_texts = [question] + chunks
        all_embeddings = model.encode(all_texts, convert_to_numpy=True)
        question_vec = all_embeddings[0]
        chunk_vecs = all_embeddings[1:]
        scores = [cosine_similarity(question_vec, cv) for cv in chunk_vecs]
        print(json.dumps({"ok": True, "scores": scores}))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}))
        sys.exit(1)
