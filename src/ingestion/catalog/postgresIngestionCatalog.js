/**
 * PostgreSQL ingestion catalog.
 *
 * Drop-in replacement for fileIngestionCatalog — same interface, different backend.
 * Portable across Supabase (PoC) and AWS RDS PostgreSQL (target).
 *
 * Prerequisites:
 *   • ingestion_catalog table created (see db/schema.sql)
 *   • DATABASE_URL env var pointing to the database
 *
 * Interface (mirrors fileIngestionCatalog):
 *   listEntries()                         — all catalog rows, ordered by ingested_at ASC
 *   getLatestDocuments()                  — alias for listEntries() (used by server.js)
 *   listEntriesBySource(sourcePath)       — rows for a specific file path
 *   getLatestEntryBySource(sourcePath)    — most recent row for a file path
 *   appendEntry(entry)                    — insert / upsert a new catalog row
 *   getInfo()                             — store metadata (replaces getPath)
 *
 * All methods are async — use `await` on every call.
 */

export function createPostgresIngestionCatalog({ pool }) {
  // Column projection reused in every SELECT
  const COLUMNS = `
    id,
    source_path      AS "sourcePath",
    product_name     AS "productName",
    jurisdiction,
    version_label    AS "versionLabel",
    document_type    AS "documentType",
    status,
    run_id           AS "runId",
    indexed_at       AS "indexedAt",
    ingested_at      AS "ingestedAt",
    metadata
  `;

  function mapRow(row) {
    return {
      ...row,
      metadata: row.metadata ?? {},
    };
  }

  return {
    /** Returns metadata about this store (replaces getPath()). */
    getInfo() {
      return { provider: "postgres", table: "ingestion_catalog" };
    },

    /**
     * Return all catalog entries ordered by ingested_at ascending.
     * questionService's latestCompletedEntries() deduplicates per source_path
     * from the full list, so returning everything is correct.
     *
     * @returns {Promise<Array>}
     */
    async listEntries() {
      const { rows } = await pool.query(
        `SELECT ${COLUMNS} FROM ingestion_catalog ORDER BY ingested_at ASC`,
      );
      return rows.map(mapRow);
    },

    /**
     * Alias for listEntries() — used by server.js to populate questionService.
     * @returns {Promise<Array>}
     */
    async getLatestDocuments() {
      return this.listEntries();
    },

    /**
     * Return all entries for a specific source file (e.g. same PDF re-ingested
     * multiple times), ordered ascending.
     *
     * @param {string} sourcePath
     * @returns {Promise<Array>}
     */
    async listEntriesBySource(sourcePath) {
      const { rows } = await pool.query(
        `SELECT ${COLUMNS} FROM ingestion_catalog
         WHERE source_path = $1
         ORDER BY ingested_at ASC`,
        [sourcePath],
      );
      return rows.map(mapRow);
    },

    /**
     * Return the most recent entry for a source file (latest re-ingestion).
     *
     * @param {string} sourcePath
     * @returns {Promise<object|null>}
     */
    async getLatestEntryBySource(sourcePath) {
      const { rows } = await pool.query(
        `SELECT ${COLUMNS} FROM ingestion_catalog
         WHERE source_path = $1
         ORDER BY ingested_at DESC
         LIMIT 1`,
        [sourcePath],
      );
      return rows.length > 0 ? mapRow(rows[0]) : null;
    },

    /**
     * Insert a new catalog entry.  Uses ON CONFLICT DO UPDATE so re-ingesting
     * the same documentVersionId is safe — it just refreshes status and run_id.
     *
     * Expected fields (all optional except id and sourcePath):
     *   id, sourcePath, productName, jurisdiction, versionLabel,
     *   documentType, status, runId, indexedAt, ingestedAt, metadata
     *
     * @param {object} entry
     * @returns {Promise<void>}
     */
    async appendEntry(entry) {
      const now = new Date().toISOString();
      const ingestedAt = entry.ingestedAt ?? entry.indexedAt ?? now;

      await pool.query(
        `INSERT INTO ingestion_catalog
           (id, source_path, product_name, jurisdiction, version_label,
            document_type, status, run_id, indexed_at, ingested_at, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
           status      = EXCLUDED.status,
           run_id      = EXCLUDED.run_id,
           indexed_at  = EXCLUDED.indexed_at`,
        [
          entry.id,
          entry.sourcePath,
          entry.productName ?? null,
          entry.jurisdiction ?? null,
          entry.versionLabel ?? null,
          entry.documentType ?? "unknown",
          entry.status ?? "completed",
          entry.runId ?? null,
          entry.indexedAt ?? now,
          ingestedAt,
          JSON.stringify(entry.metadata ?? {}),
        ],
      );
    },
  };
}
