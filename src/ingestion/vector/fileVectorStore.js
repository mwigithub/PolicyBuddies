import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export function createFileVectorStore({ filePath }) {
  const directory = dirname(filePath);
  mkdirSync(directory, { recursive: true });
  writeFileSync(filePath, "", { flag: "a" });

  return {
    appendVectors(records) {
      if (!Array.isArray(records) || records.length === 0) {
        return;
      }

      const lines = records.map((record) => JSON.stringify(record)).join("\n");
      appendFileSync(filePath, `${lines}\n`, "utf8");
    },
    listVectorsByDocumentVersion(documentVersionId) {
      const content = readFileSync(filePath, "utf8");
      return content
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .filter((record) => record.documentVersionId === documentVersionId);
    },
    getFilePath() {
      return filePath;
    },
    reset() {
      writeFileSync(filePath, "", "utf8");
    },
  };
}
