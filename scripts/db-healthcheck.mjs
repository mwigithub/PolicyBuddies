import { loadEnvFile } from "../src/config/loadEnv.js";
import { getPool, closePool } from "../src/db/pool.js";

loadEnvFile();

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Set it before running db healthcheck.");
  }

  const pool = getPool();
  try {
    const [{ rows: extRows }, { rows: tableRows }] = await Promise.all([
      pool.query(
        "select extname from pg_extension where extname = 'vector' limit 1",
      ),
      pool.query(
        `select table_name
         from information_schema.tables
         where table_schema = 'public'
           and table_name in ('ingestion_catalog', 'document_vectors')
         order by table_name`,
      ),
    ]);

    const hasVector = extRows.length > 0;
    const tableNames = tableRows.map((row) => row.table_name);
    const hasCatalog = tableNames.includes("ingestion_catalog");
    const hasVectors = tableNames.includes("document_vectors");

    console.log(
      JSON.stringify(
        {
          databaseReachable: true,
          vectorExtension: hasVector,
          ingestionCatalogTable: hasCatalog,
          documentVectorsTable: hasVectors,
        },
        null,
        2,
      ),
    );

    if (!hasVector || !hasCatalog || !hasVectors) {
      process.exit(2);
    }
  } finally {
    await closePool();
  }
}

main().catch((error) => {
  console.error("[db:healthcheck] Failed:", error?.message || String(error));
  if (error?.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
