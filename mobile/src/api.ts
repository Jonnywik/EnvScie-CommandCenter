import * as SMS from "expo-sms";
import { Alert, EvacuationCenter, LocationFix, SosOutboxItem, SyncBootstrap } from "./types";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8000/v1";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });
  if (!response.ok) throw new Error(`Request failed with ${response.status}`);
  return response.json() as Promise<T>;
}

export async function refreshSnapshot() {
  const bootstrap = await request<SyncBootstrap>("/sync/bootstrap");
  return {
    alerts: bootstrap.alerts as Alert[],
    centers: bootstrap.centers as EvacuationCenter[],
    cursor: bootstrap.cursor,
    source: bootstrap.source,
    lastSyncAt: bootstrap.generated_at,
  };
}

export async function submitSosOnline(item: SosOutboxItem) {
  return request<{ id: string; status: string }>("/sos", {
    method: "POST",
    body: JSON.stringify({
      device_public_id: item.devicePublicId,
      emergency_type: item.emergencyType,
      message: item.shortMessage,
      latitude: item.location.latitude,
      longitude: item.location.longitude,
      accuracy_meters: item.location.accuracy,
      client_occurred_at: item.clientOccurredAt,
      channel: "internet",
    }),
  });
}

function toBase36(value: number) {
  return Math.round(value).toString(36);
}

function crc32(input: string) {
  let crc = 0xffffffff;
  for (let index = 0; index < input.length; index += 1) {
    crc ^= input.charCodeAt(index);
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0").toUpperCase();
}

export function encodeSmsPayload(item: SosOutboxItem) {
  const body = [
    "CFR1",
    item.devicePublicId,
    item.nonce,
    item.emergencyType,
    toBase36(item.location.latitude * 100000),
    toBase36(item.location.longitude * 100000),
    String(Math.round(item.location.accuracy || 0)),
    String(Math.floor(new Date(item.clientOccurredAt).getTime() / 1000)),
  ].join(";");
  const payload = `${body};${crc32(body)}`;
  if (payload.length > 160) throw new Error("SOS SMS payload is longer than one segment");
  return payload;
}

export async function handoffToSms(item: SosOutboxItem, destination: string) {
  const payload = encodeSmsPayload(item);
  const available = await SMS.isAvailableAsync();
  if (!available) throw new Error("SMS is not available on this device");
  const result = await SMS.sendSMSAsync([destination], payload);
  if (!result.result) throw new Error("SMS handoff was cancelled or failed");
  return payload;
}

export async function getSafeRoute(location: LocationFix) {
  return request<{ center_name: string; distance_meters: number; estimated_seconds: number }>(
    `/routes/safest-center?latitude=${location.latitude}&longitude=${location.longitude}`,
  );
}
