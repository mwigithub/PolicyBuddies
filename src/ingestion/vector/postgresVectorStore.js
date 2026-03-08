/**
 * PostgreSQL vector store (pgvector).
 *
 * Drop-in replacement for fileVectorStore — same interface, different backend.
 * Portable across Supabase (PoC) and AWS RDS PostgreSQL (target).
 *
 * Prerequisites:
 *   • pgvector extension enabled (CREATE EXTENSION IF NOT EXISTS vector)
 *   • document_vectors table created (see db/schema.sql)
 *   • DATABASE_URL env var pointing to the database
 *
 * Interface (mirrors fileVectorStore):
 *   appendVectors(records)                    — insert batch of vector records
 *   listVectorsByDocumentVersion(versionId)   — fetch all vectors for a doc version
 *   searchSimilar(queryVector, topK, product) — cosine similarity search
 *   getStoreInfo()                            — returns provider metadata (replaces getFilePath)
 *   reset()                                   — truncate all vectors (use with care!)
 */

export function createPostgresVectorStore({ pool }) {
  return {
    /**
     * Insert a batch of vector records in a single transaction.
     * Uses ON CONFLICT DO NOTHING so re-ingesting the same document
     * is safe (idempotent).
     *
     * @param {Array<{
     *   vectorRecordId: string,
     *   runId: string,
     *   documentVersionId: string,
     *   chunkId: string,
     *   chunkText?: string,
     *   embeddingProviderName: string,
     *   embeddingProviderModel: string,
     *   vector: number[],
     *   createdAt: string,
     * }>} records
     */
    async appendVectors(records) {
      if (!Array.isArray(records) || records.length === 0) {
        return;
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        for (const r of records) {
          // pgvector expects the vector as a bracketed literal: '[0.1,0.2,...]'
          const vectorLiteral = `[${r.vector.join(",")}]`;
          await client.query(
            `INSERT INTO document_vectors
               (vector_record_id, run_id, document_version_id, chunk_id, chunk_text,
                embedding_provider_name, embedding_provider_model, vector, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, $9)
             ON CONFLICT (vector_record_id) DO NOTHING`,
            [
              r.vectorRecordId,
              r.runId,
              r.documentVersionId,
              r.chunkId,
              r.chunkText ?? null,
              r.embeddingProviderName,
              r.embeddingProviderModel,
              vectorLiteral,
              r.createdAt,
            ],
          );
        }

        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    },

    /**
     * Cosine similarity search using pgvector.
     * Returns top-K chunks closest to the query vector, joined with catalog metadata.
     * chunk_text is returned so callers don't need to read from disk.
     *
     * @param {number[]} queryVector  — 768-dim Gemini embedding of the question
     * @param {number}   topK         — number of results to return
     * @param {string|null} productName — filter by product name (null = all products)
     * @returns {Promise<Array<{ chunkId, chunkText, documentVersionId, productName, sourcePath, score }>>}
     */
    async searchSimilar(queryVector, topK = 5, productName = null) {
      const vectorLiteral = `[${queryVector.join(",")}]`;
      const params = [vectorLiteral, topK];
      let productFilter = "";
      if (productName) {
        params.push(productName);
        productFilter = `AND ic.product_name = $${params.length}`;
      }
      const { rows } = await pool.query(
        `SELECT
           dv.chunk_id             AS "chunkId",
           dv.chunk_text           AS "chunkText",
           dv.document_version_id  AS "documentVersionId",
           ic.product_name         AS "productName",
           ic.source_path          AS "sourcePath",
           1 - (dv.vector <=> $1::vector) AS score
         FROM document_vectors dv
         JOIN ingestion_catalog ic ON dv.document_version_id = ic.id
         WHERE dv.chunk_text IS NOT NULL
           ${productFilter}
         ORDER BY dv.vector <=> $1::vector
         LIMIT $2`,
        params,
      );
      return rows;
    },

    /**
     * Fetch all vector records for a specific document version.
     * The vector column is returned as a parsed number[].
     *
     * @param {string} documentVersionId
     * @returns {Promise<Array>}
     */
    async listVectorsByDocumentVersion(documentVersionId) {
      const { rows } = await pool.query(
        `SELECT
           vector_record_id          AS "vectorRecordId",
           run_id                    AS "runId",
           document_version_id       AS "documentVersionId",
           chunk_id                  AS "chunkId",
           chunk_text                AS "chunkText",
           embedding_provider_name   AS "embeddingProviderName",
           embedding_provider_model  AS "embeddingProviderModel",
           vector::text              AS vector,
           created_at                AS "createdAt"
         FROM document_vectors
         WHERE document_version_id = $1`,
        [documentVersionId],
      );

      // pgvector returns the vector as a string like "[0.1,0.2,...]" — parse it back
      return rows.map((row) => ({
        ...row,
        vector: JSON.parse(row.vector),
      }));
    },

    /**
     * Returns metadata about this store (replaces getFilePath() from fileVectorStore).
     */
    getStoreInfo() {
      return { provider: "postgres", table: "document_vectors" };
    },

    /**
     * Remove all vector records. Use only during testing or full re-ingestion.
     */
    async reset() {
      await pool.query("TRUNCATE TABLE document_vectors");
    },
  };
}
