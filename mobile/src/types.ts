export type Connectivity = "online" | "offline";
export type Transport = "internet" | "sms" | "none";
export type SosDeliveryState = "queued" | "sending" | "sent" | "acknowledged" | "failed";

export type Alert = {
  id: string;
  title: string;
  body: string;
  source_name: string;
  severity: "critical" | "warning" | "advisory" | "watch" | "info";
  hazard?: string | null;
  issued_at: string;
  expires_at?: string | null;
};

export type EvacuationCenter = {
  id: string;
  name: string;
  barangay: string;
  status: "open" | "full" | "closed" | "unknown";
  capacity_total: number;
  occupancy_current: number;
  amenities: string[];
  location: { latitude: number; longitude: number };
};

export type LocationFix = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  capturedAt: string;
};

export type SosOutboxItem = {
  localId: string;
  nonce: string;
  devicePublicId: string;
  emergencyType: string;
  shortMessage?: string;
  location: LocationFix;
  clientOccurredAt: string;
  deliveryState: SosDeliveryState;
  retryCount: number;
  lastErrorCode?: string;
  serverSosId?: string;
};

export type CachedSnapshot = {
  alerts: Alert[];
  centers: EvacuationCenter[];
  cursor?: string | null;
  source?: string | null;
  lastSyncAt: string | null;
};

export type SyncBootstrap = {
  cursor: string | null;
  generated_at: string;
  source: string;
  alerts: Alert[];
  centers: EvacuationCenter[];
};
