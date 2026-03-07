export function createInMemoryRunRepository() {
  const runs = [];

  return {
    create(run) {
      runs.push({ ...run });
      return run;
    },
    updateStatus(runId, patch) {
      const run = runs.find((item) => item.runId === runId);
      if (!run) {
        return null;
      }
      Object.assign(run, patch);
      return { ...run };
    },
    list() {
      return runs.map((run) => ({ ...run }));
    },
  };
}

export function createInMemoryAuditRepository() {
  const events = [];

  return {
    append(event) {
      events.push({ ...event });
      return event;
    },
    listByRunId(runId) {
      return events
        .filter((event) => event.runId === runId)
        .map((event) => ({ ...event }));
    },
    listAll() {
      return events.map((event) => ({ ...event }));
    },
  };
}

export function createInMemoryDocumentRepository() {
  const sourceDocuments = [];
  const documentVersions = [];
  const normalizedDocuments = [];
  const chunks = [];

  return {
    saveSourceDocument(sourceDocument) {
      sourceDocuments.push({ ...sourceDocument });
      return sourceDocument;
    },
    findLatestVersion({ productName, jurisdiction }) {
      const matches = documentVersions
        .filter(
          (version) =>
            version.productName === productName &&
            version.jurisdiction === jurisdiction,
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      return matches.length > 0 ? { ...matches[matches.length - 1] } : null;
    },
    findExistingVersion({
      productName,
      jurisdiction,
      versionLabel,
      documentType,
      sourceHash,
    }) {
      const match = documentVersions.find((version) => {
        if (
          version.productName !== productName ||
          version.jurisdiction !== jurisdiction ||
          version.versionLabel !== versionLabel ||
          version.documentType !== documentType
        ) {
          return false;
        }
        const source = sourceDocuments.find(
          (item) => item.sourceDocumentId === version.sourceDocumentId,
        );
        return source?.sourceHash === sourceHash;
      });
      return match ? { ...match } : null;
    },
    saveDocumentVersion(version) {
      documentVersions.push({ ...version });
      return version;
    },
    markSuperseded(documentVersionId) {
      const item = documentVersions.find(
        (version) => version.documentVersionId === documentVersionId,
      );
      if (item) {
        item.status = "superseded";
      }
    },
    saveNormalizedDocument(normalizedDocument) {
      normalizedDocuments.push({ ...normalizedDocument });
      return normalizedDocument;
    },
    getNormalizedDocument(documentVersionId) {
      const item = normalizedDocuments.find(
        (doc) => doc.documentVersionId === documentVersionId,
      );
      return item ? { ...item } : null;
    },
    saveChunks(chunkRecords) {
      chunks.push(...chunkRecords.map((chunk) => ({ ...chunk })));
      return chunkRecords;
    },
    listVersions() {
      return documentVersions.map((version) => ({ ...version }));
    },
    listChunks(documentVersionId) {
      return chunks
        .filter((chunk) => chunk.documentVersionId === documentVersionId)
        .map((chunk) => ({ ...chunk }));
    },
  };
}
