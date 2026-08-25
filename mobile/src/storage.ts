import AsyncStorage from "@react-native-async-storage/async-storage";
import { CachedSnapshot, SosOutboxItem } from "./types";

const SNAPSHOT_KEY = "cfr.snapshot.v1";
const OUTBOX_KEY = "cfr.sos-outbox.v1";
const DEVICE_KEY = "cfr.device-public-id.v1";

export async function readOrCreateDevicePublicId() {
  const existing = await AsyncStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const devicePublicId = `cfr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
  await AsyncStorage.setItem(DEVICE_KEY, devicePublicId);
  return devicePublicId;
}

export async function readSnapshot(): Promise<CachedSnapshot> {
  const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
  if (!raw) return { alerts: [], centers: [], cursor: null, source: null, lastSyncAt: null };
  try {
    return JSON.parse(raw) as CachedSnapshot;
  } catch {
    return { alerts: [], centers: [], cursor: null, source: null, lastSyncAt: null };
  }
}

export async function writeSnapshot(snapshot: CachedSnapshot) {
  await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export async function readOutbox(): Promise<SosOutboxItem[]> {
  const raw = await AsyncStorage.getItem(OUTBOX_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SosOutboxItem[];
  } catch {
    return [];
  }
}

export async function writeOutbox(items: SosOutboxItem[]) {
  await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
}

export async function enqueueSos(item: SosOutboxItem) {
  const current = await readOutbox();
  await writeOutbox([...current, item]);
}

export async function updateOutboxItem(localId: string, patch: Partial<SosOutboxItem>) {
  const current = await readOutbox();
  await writeOutbox(current.map((item) => item.localId === localId ? { ...item, ...patch } : item));
}
