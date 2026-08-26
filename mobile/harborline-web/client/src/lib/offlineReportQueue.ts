export type OfflineReportPayload = {
  clientRequestId: string;
  category: "flooding" | "road_blockage" | "structural_damage" | "medical_sos" | "other";
  description?: string;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  photo: { dataUrl: string; filename: string };
};

const DB_NAME = "harborline-offline";
const STORE = "report-outbox";

function openQueue() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "clientRequestId" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function queueOfflineReport(payload: OfflineReportPayload) {
  const db = await openQueue();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ ...payload, queuedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function readOfflineReports(): Promise<OfflineReportPayload[]> {
  const db = await openQueue();
  const records = await new Promise<OfflineReportPayload[]>((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as OfflineReportPayload[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return records;
}

export async function removeOfflineReport(clientRequestId: string) {
  const db = await openQueue();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(clientRequestId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
