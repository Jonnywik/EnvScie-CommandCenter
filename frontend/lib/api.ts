export type Severity = "critical" | "warning" | "advisory";
export type SosStatus = "received" | "acknowledged" | "dispatched" | "resolved" | "false_alarm";

export type Location = {
  latitude: number;
  longitude: number;
  accuracy_meters?: number | null;
};

export type SosIncident = {
  id: string;
  severity: Severity;
  status: SosStatus;
  emergency_type: string;
  channel: "internet" | "sms" | "mesh" | "manual";
  barangay: string;
  location: Location;
  received_at: string;
  summary: string;
};

export type CoordinatorEmergencyCreate = {
  emergency_type: string;
  severity: "critical" | "warning" | "advisory";
  summary: string;
  barangay: string;
  latitude: number;
  longitude: number;
  accuracy_meters?: number;
  reporter_name?: string;
  reporter_contact?: string;
  occurred_at?: string;
};

export type SosCreateResult = {
  id: string;
  status: SosStatus;
  received_at: string;
  channel: SosIncident["channel"];
};

export type AlertItem = {
  id: string;
  source_name: string;
  source_event_id: string;
  title: string;
  body: string;
  severity: Severity;
  hazard?: string | null;
  issued_at: string;
  expires_at?: string | null;
  source_url?: string | null;
};

export type Center = {
  id: string;
  name: string;
  barangay: string;
  status: "open" | "full" | "closed" | "unknown";
  capacity_total: number;
  occupancy_current: number;
  amenities: string[];
  location: { latitude: number; longitude: number };
  distance_meters?: number;
};

export type UserIdentity = {
  id: string;
  display_name: string;
  role: "resident" | "dispatcher" | "responder" | "admin";
  is_active: boolean;
};

export type FeedHealth = {
  source_name: string;
  endpoint_url?: string | null;
  last_success_at?: string | null;
  last_checked_at?: string | null;
  last_error_at?: string | null;
  last_error?: string | null;
  last_content_hash?: string | null;
  stale: boolean;
};

export type AlertPollResult = {
  source_name: string;
  run_id: string;
  status: string;
  items_seen: number;
  items_inserted: number;
  items_updated: number;
  completed_at: string;
};

export type AuditEvent = {
  id: number | string;
  actor_user_id?: string | null;
  actor_role?: UserIdentity["role"] | null;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type DashboardSummary = {
  generated_at: string;
  source: string;
  freshness: string;
  metrics: {
    untriaged_sos: number;
    critical_alerts: number;
    open_centers: number;
    residents_at_risk: number;
  };
  sos: SosIncident[];
  alerts: AlertItem[];
  centers: Center[];
};

export type IncidentStatus = "open" | "monitoring" | "escalated" | "stabilized" | "closed" | "reopened";
export type IncidentAction = "monitor" | "escalate" | "stabilize" | "close" | "reopen";

export type IncidentEvent = {
  id: string;
  incident_id: string;
  action: string;
  from_status?: IncidentStatus | null;
  to_status: IncidentStatus;
  note?: string | null;
  actor_user_id?: string | null;
  actor_role?: UserIdentity["role"] | null;
  occurred_at: string;
};

export type IncidentRecord = {
  id: string;
  status: IncidentStatus;
  severity: Severity;
  emergency_type: string;
  barangay: string;
  summary: string;
  linked_sos_ids: string[];
  follow_up_owner?: string | null;
  follow_up_due_at?: string | null;
  created_at: string;
  updated_at: string;
  events: IncidentEvent[];
  decision_limit: string;
};

export type IncidentSnapshot = { generated_at: string; source: "demo-seed" | "database"; incidents: IncidentRecord[] };

export type DispatchTeam = {
  id: string;
  name: string;
  mission: string;
  status: "standby" | "en_route" | "deployed" | "returning";
  lead: string;
  members: number;
  vehicle: string;
  channel: string;
  last_update: string;
};

export type ResponseGroupAvailability = "available" | "limited" | "assigned" | "standby" | "offline";
export type ResponseGroupStatus = "ready" | "en_route" | "deployed" | "returning" | "standby" | "offline";

export type ResponseGroup = {
  id: string;
  name: string;
  agency: string;
  group_type: string;
  specialties: string[];
  status: ResponseGroupStatus;
  availability: ResponseGroupAvailability;
  readiness_score: number;
  personnel_ready: number;
  personnel_total: number;
  lead: string;
  contact_channel: string;
  call_sign: string;
  location: { latitude: number; longitude: number };
  location_label: string;
  location_source: "gps" | "radio" | "manual" | "last_known";
  last_location_at: string;
  location_accuracy_meters?: number | null;
  vehicle_or_asset: string;
  current_assignment?: string | null;
  assignment_target?: string | null;
  estimated_response_minutes?: number | null;
  equipment: string[];
  constraints: string[];
  last_check_in_at: string;
  notes?: string | null;
};

export type ResponseGroupSnapshot = {
  generated_at: string;
  source: "demo-seed" | "postgis";
  groups: ResponseGroup[];
  specialties: string[];
  availability_counts: Record<ResponseGroupAvailability, number>;
  stale_location_count: number;
};

export type ResourceItem = {
  id: string;
  name: string;
  category: "rescue" | "medical" | "transport" | "relief" | "communications";
  location: string;
  available: number;
  total: number;
  unit: string;
  status: "ready" | "low" | "deployed" | "unavailable";
  owner: string;
};

export type CommunicationsPlan = {
  id: string;
  title: string;
  audience: string;
  channel: "radio" | "sms" | "social" | "sirens" | "field_runner";
  status: "draft" | "queued" | "sent" | "acknowledged";
  owner: string;
  sent_at?: string | null;
  acknowledgements: number;
  target_count: number;
};

export type BarangayReadiness = {
  barangay: string;
  population_at_risk: number;
  priority: "high" | "medium" | "low";
  evacuation_status: "not_started" | "mobilizing" | "in_progress" | "complete";
  assigned_center: string;
  transport: string;
  last_contact: string;
  needs: string[];
};

export type HazardLayer = {
  id: string;
  name: string;
  type: "flood" | "storm_surge" | "landslide" | "road_closure";
  severity: "critical" | "warning" | "advisory";
  status: "active" | "monitoring" | "cleared";
  affected_area: string;
  last_verified: string;
  action: string;
};

export type CommandCenterTask = {
  id: string;
  title: string;
  owner: string;
  priority: "critical" | "high" | "routine";
  status: "open" | "in_progress" | "blocked" | "complete";
  due_by: string;
  dependency?: string | null;
};

export type OperationsSnapshot = {
  generated_at: string;
  incident_phase: "preparedness" | "response" | "recovery";
  operating_period: string;
  objectives: string[];
  teams: DispatchTeam[];
  resources: ResourceItem[];
  communications: CommunicationsPlan[];
  readiness: BarangayReadiness[];
  hazards: HazardLayer[];
  tasks: CommandCenterTask[];
};

export type OperationsActionResult = {
  status: "recorded" | "updated";
  action_id: number | string;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  recorded_at: string;
  mutated?: boolean;
  message?: string;
  changes?: string[];
};

export type SafeRoute = {
  center_id: string;
  center_name: string;
  distance_meters: number;
  estimated_seconds: number;
  route: Array<{ latitude: number; longitude: number }>;
  avoided_hazard_count: number;
  route_is_safe_as_of: string;
};

export type GisResourceState = "ready" | "standby" | "en_route" | "deployed" | "stale" | "offline";
export type GisResourceKind = "team" | "vehicle" | "boat" | "supply" | "medical" | "communications";

export type GisResource = {
  id: string;
  label: string;
  kind: GisResourceKind;
  owner: string;
  state: GisResourceState;
  position: { latitude: number; longitude: number };
  reported_at?: string | null;
  accuracy_meters?: number | null;
  heading_degrees?: number | null;
  speed_kph?: number | null;
  battery_pct?: number | null;
  current_assignment?: string | null;
  last_update_source?: string | null;
};

export type GisHazard = {
  id: string;
  name: string;
  hazard: string;
  severity: string;
  status: string;
  polygon: Array<{ latitude: number; longitude: number }>;
  last_verified: string;
  action: string;
};

export type GisMapSnapshot = {
  generated_at: string;
  source: "demo-seed" | "postgis";
  center: { latitude: number; longitude: number };
  bbox: [number, number, number, number];
  resources: GisResource[];
  hazards: GisHazard[];
  centers: Array<{
    id: string;
    name: string;
    status: string;
    capacity_total: number;
    occupancy_current: number;
    position: { latitude: number; longitude: number };
  }>;
  sos: Array<{
    id: string;
    status: string;
    severity: string;
    position: { latitude: number; longitude: number };
    accuracy_meters?: number | null;
    summary: string;
  }>;
  source_health: MapSourceHealth[];
};

export type MapSourceHealth = {
  id: string;
  label: string;
  category: "alert_feed" | "weather_overlay" | "hazard_reference" | "facility_reference";
  provenance_url?: string | null;
  last_success_at?: string | null;
  last_checked_at?: string | null;
  stale_after_seconds?: number | null;
  status: "healthy" | "stale" | "reference_only" | "unavailable";
  review_required: true;
  decision_limit: string;
};

export type NoahOverlayLayer = {
  id: "noah-flood-100yr" | "noah-landslide" | "noah-storm-surge-scenarios";
  hazard: "flood" | "landslide" | "storm_surge";
  label: string;
  scenario: string;
  overlay_url: string;
  rendered_parts: number;
};

export type NoahMapContext = {
  provider: string;
  dataset_title: string;
  dataset_url: string;
  license: string;
  attribution: string;
  source_geometry_dates: Record<string, string>;
  focus_bbox: { west: number; south: number; east: number; north: number };
  decision_limit: string;
  layers: NoahOverlayLayer[];
  critical_facilities: {
    status: "source_access_unconfirmed" | "available";
    source_url: string;
    message: string;
  };
};

export type OfficialFacility = {
  id: string;
  name: string;
  category: "hospital" | "rural_health_unit";
  ownership: "public" | "private" | "unknown";
  address: string;
  position: { latitude: number; longitude: number };
  source_name: string;
  source_url: string;
  coordinate_source: string;
  coordinate_validation_status: "verified" | "needs_lgu_verification";
  validation_message: string;
};

export type OfficialFacilityRegistry = {
  provider: string;
  scope: string;
  source_status: "available" | "limited_official_coverage";
  decision_limit: string;
  facilities: OfficialFacility[];
};

export type FacilityVerificationOutcome = "reference_verified" | "follow_up_required" | "not_verified";
export type FacilityReportedAccess = "not_assessed" | "reported_open" | "reported_restricted" | "reported_unavailable";

export type FacilityVerificationRecord = {
  id: string;
  facility_id: string;
  coordinate_confirmed: boolean;
  contact_attempted: boolean;
  reported_access: FacilityReportedAccess;
  verification_outcome: FacilityVerificationOutcome;
  source_document_reference: string;
  revalidation_due_at: string;
  verification_note: string;
  verified_by_user_id?: string | null;
  verified_by_role?: UserIdentity["role"] | null;
  verified_at: string;
  decision_limit: string;
};

export type FacilityVerificationSnapshot = {
  generated_at: string;
  source: "demo-seed" | "database";
  records: FacilityVerificationRecord[];
};

export type RadarFrame = {
  time: number;
  path: string;
};

export type RadarSnapshot = {
  frames: RadarFrame[];
  host: string | null;
  max_zoom?: number;
  fetched_at: string;
  stale: boolean;
};

export type OverlayFreshness = "live" | "cached" | "stale" | "rate_limited" | "unavailable";

export type MapOverlayMeta = {
  id: string;
  kind: "radar_qpe" | "station_observation" | "satellite" | "lightning" | string;
  provider: string;
  source_url: string;
  observed_at: string | null;
  fetched_at: string;
  expires_at: string | null;
  freshness: OverlayFreshness;
  coverage: string;
  resolution: string | null;
  decision_limit: string;
  access_state: "ready" | "pending_approval" | "pending_procurement" | string;
  message: string;
};

export type MapOverlayStation = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  observed_at: string;
  rainfall_mm?: number | null;
  wind_kph?: number | null;
  freshness: OverlayFreshness;
};

export type MapOverlayLightningEvent = {
  id: string;
  latitude: number;
  longitude: number;
  observed_at: string;
  quality?: string | null;
};

export type MapOverlaysSnapshot = {
  fetched_at: string;
  stale: boolean;
  rainviewer_radar: RadarSnapshot;
  typhoon: TyphoonSnapshot;
  pagasa_radar: MapOverlayMeta & { frames: RadarFrame[]; host?: string | null; min_zoom?: number; max_zoom?: number };
  pagasa_stations: MapOverlayMeta & { stations: MapOverlayStation[] };
  pagasa_satellite: MapOverlayMeta & { frame: { url: string; bounds: [number, number, number, number] } | null };
  lightning: MapOverlayMeta & { events: MapOverlayLightningEvent[]; history_minutes: number };
  decision_limit: string;
};

export type TyphoonTrackPoint = {
  latitude: number;
  longitude: number;
};

export type TyphoonSnapshot = {
  active: boolean;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  issued_at: string | null;
  track: TyphoonTrackPoint[];
  fetched_at: string;
  stale: boolean;
  source_url: string;
};

export type ProvincialWeatherWarning = {
  id: string;
  type: "heavy_rainfall" | "thunderstorm" | string;
  statement: string;
  province_specific: boolean;
  source_url: string;
};

export type ProvincialHazardReference = {
  id: "flood-risk" | "landslide-susceptibility" | "storm-surge" | string;
  title: string;
  hazard: "flood" | "landslide" | "storm_surge" | string;
  coverage: string;
  model_scope: string;
  classes: string[];
  source_name: string;
  source_url: string;
  decision_limit: string;
};

export type ProvincialWeatherSource = {
  name: string;
  url: string;
  kind: string;
};

export type ProvincialWeatherSnapshot = {
  province: string;
  regional_office: string;
  weather_summary: string;
  issued_at: string | null;
  province_mentioned: boolean;
  warnings: ProvincialWeatherWarning[];
  hazard_references: ProvincialHazardReference[];
  source_links: ProvincialWeatherSource[];
  fetched_at: string;
  stale: boolean;
};

export type FloodRiskAssessment = {
  assessment_id: string;
  trigger: "operator_requested";
  risk_level: "high" | "review_required" | "monitor" | "insufficient_data";
  review_required: true;
  public_communication_sent: false;
  evaluated_at: string;
  province: string;
  source_freshness: { fresh: boolean; age_seconds: number | null; source_fetched_at: string | null; source_stale: boolean };
  factors: Array<{ signal: string; status: "met" | "review" | "not_met" | "blocked" | "context_only"; detail: string }>;
  warning: ProvincialWeatherWarning | null;
  hazard_context: ProvincialHazardReference[];
  source_links: ProvincialWeatherSource[];
  decision_limits: string[];
};

export type ResponderSafetyFactor = {
  factor: "incident_hazard" | "responder_exposure" | "responder_vulnerability" | "operational_controls" | "route_uncertainty";
  points: number;
  detail: string;
};

export type ResponderSafetyCandidate = {
  group_id: string;
  group_name: string;
  call_sign: string | null;
  risk_score: number;
  risk_band: "low" | "moderate" | "high" | "severe";
  review_status: "hold" | "coordinator_review_required";
  distance_meters: number;
  location_age_minutes: number;
  check_in_age_minutes: number;
  readiness_score: number;
  availability: string;
  factors: ResponderSafetyFactor[];
  hold_reasons: string[];
  protective_controls: string[];
  field_execution_tasks: string[];
  recorded_constraints: string[];
};

export type ResponderSafetyAssessment = {
  assessment_id: string;
  generated_at: string;
  source: string;
  engine_version: string;
  incident: {
    id: string;
    status: string;
    severity: string;
    emergency_type: string;
    barangay: string;
    location: SosIncident["location"];
  };
  active_hazard_count: number;
  assessments: ResponderSafetyCandidate[];
  command_center_tasks: string[];
  decision_limits: string[];
  automatic_dispatch_created: false;
  route_cleared: false;
};

export type OptimizedRoute = SafeRoute & {
  origin: { latitude: number; longitude: number };
  blocked_segment_count: number;
  route_status: "safe" | "stale" | "blocked";
  warnings: string[];
};

export type CommunicationEvent = {
  id: string;
  occurred_at: string;
  direction: "inbound" | "outbound" | "broadcast";
  channel: "VHF" | "HF" | "SMS" | "phone" | "field_runner";
  from_unit: string;
  to_unit: string;
  message: string;
  priority: "routine" | "priority" | "urgent" | "distress";
  status: "received" | "acknowledged" | "sent" | "failed";
  acknowledged_at?: string | null;
  linked_incident_id?: string | null;
  operator: string;
};

export type AudioDispatchItem = {
  id: string;
  started_at: string;
  duration_seconds: number;
  channel: "VHF" | "HF" | "SMS" | "phone" | "field_runner";
  from_unit: string;
  to_unit: string;
  transcript: string;
  priority: "routine" | "priority" | "urgent" | "distress";
  status: "playing" | "queued" | "played";
  linked_incident_id?: string | null;
  waveform: number[];
};

export type CommunicationSnapshot = {
  generated_at: string;
  source: "demo-seed" | "database";
  events: CommunicationEvent[];
  audio_feed: AudioDispatchItem[];
  channel_health: Record<string, "clear" | "busy" | "degraded">;
  unread_count: number;
};

export type RecommendationFactor = {
  factor: string;
  points: number;
  detail: string;
};

export type DispatchRecommendation = {
  rank: number;
  group_id: string;
  group_name: string;
  eligibility: "recommended" | "eligible" | "constrained" | "ineligible";
  score: number;
  distance_meters: number;
  estimated_response_minutes?: number | null;
  specialty_match: string[];
  missing_specialties: string[];
  freshness_minutes: number;
  factors: RecommendationFactor[];
  reasons: string[];
  constraints: string[];
};

export type RecommendationResponse = {
  generated_at: string;
  source: "demo-engine" | "postgis-engine";
  engine_version: string;
  incident: {
    incident_id: string;
    severity: string;
    emergency_type: string;
    latitude: number;
    longitude: number;
    required_specialties: string[];
  };
  recommended_group_id?: string | null;
  recommendations: DispatchRecommendation[];
  safety_notes: string[];
};

export type NotificationChannel = "sms" | "push" | "in_app";
export type NotificationStatus = "queued" | "sending" | "delivered" | "failed" | "acknowledged";

export type AssignmentNotification = {
  id: string;
  group_id: string;
  target_type: "sos_request" | "task" | "barangay" | "evacuation_center" | string;
  target_id: string;
  channel: NotificationChannel;
  channels: NotificationChannel[];
  status: NotificationStatus;
  message: string;
  recipient_label: string;
  recipient_address?: string | null;
  created_at: string;
  sent_at?: string | null;
  delivered_at?: string | null;
  acknowledged_at?: string | null;
  attempts: number;
  last_error?: string | null;
  assignment_note?: string | null;
  actor_user_id?: string | null;
};

export type NotificationSnapshot = {
  generated_at: string;
  source: "demo-seed" | "database";
  notifications: AssignmentNotification[];
  pending_count: number;
  failed_count: number;
};

export type DispatchLifecycleStatus = "pending_confirmation" | "confirmed" | "acknowledged" | "escalated" | "cancelled" | "closed";

export type DispatchLifecycleEvent = {
  id: string;
  assignment_id: string;
  event_type: string;
  from_status?: DispatchLifecycleStatus | null;
  to_status: DispatchLifecycleStatus;
  note?: string | null;
  actor_user_id?: string | null;
  actor_role?: UserIdentity["role"] | null;
  occurred_at: string;
};

export type DispatchLifecycleAssignment = {
  assignment_id: string;
  group_id: string;
  target_type: string;
  target_id: string;
  assignment_note?: string | null;
  status: DispatchLifecycleStatus;
  created_at: string;
  confirmed_at?: string | null;
  acknowledged_at?: string | null;
  escalated_at?: string | null;
  cancelled_at?: string | null;
  closed_at?: string | null;
  events: DispatchLifecycleEvent[];
  confirmation_required: true;
  decision_limit: string;
};

export type DispatchLifecycleSnapshot = {
  generated_at: string;
  source: "demo-seed" | "database";
  assignments: DispatchLifecycleAssignment[];
};

// Public deployments must not ask the operator's browser to contact its own localhost.
// Use the Next.js same-origin proxy by default; local integrations can still override this.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || (typeof window === "undefined" ? "http://127.0.0.1:8000/v1" : "/api/v1");

function websocketEndpoint(path: string) {
  if (/^https?:\/\//.test(API_BASE)) {
    return `${API_BASE.replace(/^http/, "ws").replace(/\/v1$/, "")}${path}`;
  }
  if (typeof window === "undefined") return `ws://127.0.0.1:8000${path}`;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api${path}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("cfr_access_token");
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function demoLogin(role: UserIdentity["role"] = "dispatcher") {
  return request<{ access_token: string; expires_in: number; user: UserIdentity }>("/auth/demo-login", {
    method: "POST",
    body: JSON.stringify({ role, display_name: role === "dispatcher" ? "Duty officer" : role }),
  }).then((result) => {
    if (typeof window !== "undefined") window.localStorage.setItem("cfr_access_token", result.access_token);
    return result;
  });
}

export function getCurrentUser() {
  return request<UserIdentity>("/auth/me");
}

export function getAuditEvents(limit = 20) {
  return request<AuditEvent[]>(`/auth/audit?limit=${limit}`);
}

export function getFeedHealth() {
  return request<FeedHealth[]>("/admin/feeds/health");
}

export function pollConfiguredFeeds() {
  return request<AlertPollResult>("/admin/feeds/poll", { method: "POST" });
}

export function getDashboardSummary() {
  return request<DashboardSummary>("/dashboard/summary");
}

export function getIncidents() {
  return request<IncidentSnapshot>("/incidents");
}

export function createIncidentFromSos(sosId: string, payload: { summary?: string; follow_up_owner?: string; follow_up_due_at?: string }) {
  return request<IncidentRecord>(`/incidents/from-sos/${encodeURIComponent(sosId)}`, { method: "POST", body: JSON.stringify(payload) });
}

export function transitionIncident(incidentId: string, payload: { action: IncidentAction; note: string; follow_up_owner?: string; follow_up_due_at?: string }) {
  return request<IncidentRecord>(`/incidents/${encodeURIComponent(incidentId)}/transition`, { method: "POST", body: JSON.stringify(payload) });
}

export function getOperations() {
  return request<OperationsSnapshot>("/dashboard/operations");
}

export function getResponseGroups() {
  return request<ResponseGroupSnapshot>("/response-groups");
}

export function getNotifications() {
  return request<NotificationSnapshot>("/notifications");
}

export function acknowledgeNotification(id: string, note?: string) {
  return request<AssignmentNotification>(`/notifications/${id}/acknowledge`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export function retryNotification(id: string) {
  return request<AssignmentNotification>(`/notifications/${id}/retry`, {
    method: "POST",
  });
}

export function assignResponseGroup(payload: {
  group_id: string;
  target_type: "sos_request" | "task" | "barangay" | "evacuation_center";
  target_id: string;
  assignment_note?: string;
}) {
  return request<{ status: DispatchLifecycleStatus; group: ResponseGroup; target_type: string; target_id: string; assignment_id: string; assigned_at: string; confirmation_required: true; decision_limit: string }>("/response-groups/assign", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getDispatchLifecycle(targetId?: string) {
  return request<DispatchLifecycleSnapshot>(`/response-groups/dispatch-lifecycle${targetId ? `?target_id=${encodeURIComponent(targetId)}` : ""}`);
}

export function transitionDispatchLifecycle(assignmentId: string, payload: { action: "confirm" | "acknowledge" | "escalate" | "cancel" | "close"; note?: string; operator_confirmed?: boolean }) {
  return request<DispatchLifecycleAssignment>(`/response-groups/assignments/${assignmentId}/transition`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function recordOperationsAction(payload: {
  action: string;
  resource_type: string;
  resource_id?: string;
  note?: string;
}) {
  return request<OperationsActionResult>("/dashboard/operations/actions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getAlerts() {
  return request<AlertItem[]>("/alerts");
}

export function getCenters() {
  return request<Center[]>("/evacuation-centers");
}

export function updateSosStatus(id: string, status: SosStatus, note?: string) {
  return request<SosIncident>(`/sos/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, note }),
  });
}

export function createCoordinatorEmergency(payload: CoordinatorEmergencyCreate) {
  return request<SosCreateResult>("/sos/manual", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getSafeRoute(latitude: number, longitude: number) {
  return request<SafeRoute>(`/routes/safest-center?latitude=${latitude}&longitude=${longitude}`);
}

export function getGisMap() {
  return request<GisMapSnapshot>("/gis/map");
}

export function getMapSourceHealth() {
  return request<MapSourceHealth[]>("/gis/source-health");
}

export function reviewMapSource(sourceId: string, reviewNote?: string) {
  return request<{ source_id: string; reviewed_at: string; review_required: true; status: MapSourceHealth["status"]; decision_limit: string }>("/gis/source-health/review", {
    method: "POST",
    body: JSON.stringify({ source_id: sourceId, review_note: reviewNote }),
  });
}

export function getNoahMapContext() {
  return request<NoahMapContext>("/gis/noah/context");
}

export function getOfficialFacilityRegistry() {
  return request<OfficialFacilityRegistry>("/gis/facilities/official-registry");
}

export function getFacilityVerifications(facilityId?: string) {
  return request<FacilityVerificationSnapshot>(`/gis/facilities/verifications${facilityId ? `?facility_id=${encodeURIComponent(facilityId)}` : ""}`);
}

export function createFacilityVerification(payload: {
  facility_id: string;
  coordinate_confirmed: boolean;
  contact_attempted: boolean;
  reported_access: FacilityReportedAccess;
  verification_outcome: FacilityVerificationOutcome;
  source_document_reference: string;
  revalidation_due_at: string;
  verification_note: string;
}) {
  return request<FacilityVerificationRecord>("/gis/facilities/verifications", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getWeatherRadar() {
  return request<RadarSnapshot>("/weather/radar");
}

export function getWeatherTyphoon() {
  return request<TyphoonSnapshot>("/weather/typhoon");
}

export function getMapOverlays() {
  return request<MapOverlaysSnapshot>("/weather/map-overlays");
}

export function getProvincialWeatherSituation() {
  return request<ProvincialWeatherSnapshot>("/weather/provincial-situation");
}

export function assessFloodRisk() {
  return request<FloodRiskAssessment>("/weather/flood-risk-assessment", { method: "POST" });
}

export function assessResponderSafety(sosId: string) {
  return request<ResponderSafetyAssessment>("/sos/responder-safety-assessment", {
    method: "POST",
    body: JSON.stringify({ sos_id: sosId }),
  });
}

export function updateGisResourcePosition(resourceId: string, payload: {
  latitude: number;
  longitude: number;
  accuracy_meters?: number;
  heading_degrees?: number;
  speed_kph?: number;
  battery_pct?: number;
  state?: GisResourceState;
  source?: "gps" | "manual" | "radio" | "sms";
}) {
  return request<GisResource>(`/gis/resources/${resourceId}/position`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function optimizeGisRoute(latitude: number, longitude: number, destinationCenterId?: string) {
  return request<OptimizedRoute>("/gis/routes/optimize", {
    method: "POST",
    body: JSON.stringify({ latitude, longitude, destination_center_id: destinationCenterId }),
  });
}

export function getCoordinationCommunications() {
  return request<CommunicationSnapshot>("/coordination/communications");
}

export function sendCoordinationCommunication(payload: {
  channel: CommunicationEvent["channel"];
  to_unit: string;
  message: string;
  priority: CommunicationEvent["priority"];
  linked_incident_id?: string;
  simulate_audio?: boolean;
}) {
  return request<{ status: "sent"; communication: CommunicationEvent }>("/coordination/communications", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getDispatchRecommendations(payload: {
  incident_id: string;
  severity: Severity;
  emergency_type: string;
  latitude: number;
  longitude: number;
  required_specialties?: string[];
  max_results?: number;
}) {
  return request<RecommendationResponse>("/coordination/recommendations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function subscribeToSosEvents(onEvent: (event: SosIncident & { event: string }) => void) {
  if (typeof window === "undefined") return () => undefined;
  const socket = new WebSocket(websocketEndpoint("/v1/ws/lgu"));
  socket.onmessage = (message) => {
    try {
      onEvent(JSON.parse(message.data) as SosIncident & { event: string });
    } catch {
      // Ignore malformed events and rely on the next snapshot refresh.
    }
  };
  return () => socket.close();
}

export function subscribeToGisEvents(onEvent: (event: { event: string; resource?: GisResource }) => void) {
  if (typeof window === "undefined") return () => undefined;
  const socket = new WebSocket(websocketEndpoint("/v1/ws/gis"));
  socket.onmessage = (message) => {
    try {
      onEvent(JSON.parse(message.data) as { event: string; resource?: GisResource });
    } catch {
      // Ignore malformed events and rely on the next snapshot refresh.
    }
  };
  return () => socket.close();
}

export function subscribeToResponseGroupEvents(onEvent: (event: { event: string; group?: ResponseGroup }) => void) {
  if (typeof window === "undefined") return () => undefined;
  const socket = new WebSocket(websocketEndpoint("/v1/ws/response-groups"));
  socket.onmessage = (message) => {
    try {
      onEvent(JSON.parse(message.data) as { event: string; group?: ResponseGroup });
    } catch {
      // Ignore malformed events and rely on the next snapshot refresh.
    }
  };
  return () => socket.close();
}

export function subscribeToCoordinationEvents(onEvent: (event: { event: string; communication?: CommunicationEvent }) => void) {
  if (typeof window === "undefined") return () => undefined;
  const socket = new WebSocket(websocketEndpoint("/v1/ws/coordination"));
  socket.onmessage = (message) => {
    try {
      onEvent(JSON.parse(message.data) as { event: string; communication?: CommunicationEvent });
    } catch {
      // Ignore malformed events and rely on the next snapshot refresh.
    }
  };
  return () => socket.close();
}

export function subscribeToNotificationEvents(onEvent: (event: { event: string; notification?: AssignmentNotification; notifications?: AssignmentNotification[] }) => void) {
  if (typeof window === "undefined") return () => undefined;
  const socket = new WebSocket(websocketEndpoint("/v1/ws/notifications"));
  socket.onmessage = (message) => {
    try {
      onEvent(JSON.parse(message.data) as { event: string; notification?: AssignmentNotification; notifications?: AssignmentNotification[] });
    } catch {
      // Ignore malformed events and rely on the next snapshot refresh.
    }
  };
  return () => socket.close();
}
