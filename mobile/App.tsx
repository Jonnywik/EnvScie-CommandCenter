import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert as RNAlert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import * as Location from "expo-location";
import { encodeSmsPayload, getSafeRoute, handoffToSms, refreshSnapshot, submitSosOnline } from "./src/api";
import { enqueueSos, readOutbox, readSnapshot, updateOutboxItem, writeSnapshot } from "./src/storage";
import { Alert, CachedSnapshot, Connectivity, EvacuationCenter, LocationFix, SosOutboxItem } from "./src/types";

const LGU_SMS_NUMBER = process.env.EXPO_PUBLIC_LGU_SMS_NUMBER || "";
const DEVICE_PUBLIC_ID = "balangiga-demo-device";

type Tab = "home" | "map" | "centers" | "toolkit";

function relativeTime(value: string | null) {
  if (!value) return "not yet synced";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  return minutes < 1 ? "just now" : `${minutes} min ago`;
}

function severityColor(severity: Alert["severity"]) {
  if (severity === "critical") return "#be123c";
  if (severity === "warning") return "#c2410c";
  return "#0369a1";
}

function ConnectionBanner({ connectivity, lastSyncAt }: { connectivity: Connectivity; lastSyncAt: string | null }) {
  return <View style={[styles.connectionBanner, connectivity === "offline" && styles.offlineBanner]}><View style={[styles.statusDot, connectivity === "offline" && styles.offlineDot]} /><Text style={styles.connectionText}>{connectivity === "online" ? "Connected · verified feed available" : `Offline mode · last verified sync ${relativeTime(lastSyncAt)}`}</Text></View>;
}

function AlertCard({ alert }: { alert: Alert }) {
  return <View style={styles.alertCard}><View style={styles.alertRow}><View style={[styles.severityBar, { backgroundColor: severityColor(alert.severity) }]} /><View style={{ flex: 1 }}><View style={styles.alertTop}><Text style={styles.alertTitle}>{alert.title}</Text><Text style={[styles.severityLabel, { color: severityColor(alert.severity) }]}>{alert.severity}</Text></View><Text style={styles.alertBody}>{alert.body}</Text><Text style={styles.sourceLabel}>{alert.source_name} · {relativeTime(alert.issued_at)}</Text></View></View></View>;
}

function HomeScreen({ alerts, outbox, connectivity, lastSyncAt, onSos }: { alerts: Alert[]; outbox: SosOutboxItem[]; connectivity: Connectivity; lastSyncAt: string | null; onSos: () => void }) {
  return <ScrollView contentContainerStyle={styles.screenContent}><ConnectionBanner connectivity={connectivity} lastSyncAt={lastSyncAt} /><View style={styles.hero}><Text style={styles.eyebrow}>BALANGIGA COMMUNITY SAFETY</Text><Text style={styles.heroTitle}>Stay informed. Move early. Ask for help.</Text><Text style={styles.heroCopy}>Verified local alerts and offline emergency tools for coastal and mountainous communities.</Text><Pressable style={styles.sosButton} onPress={onSos}><Text style={styles.sosButtonLabel}>SOS</Text><Text style={styles.sosButtonSub}>Hold or tap to request help</Text></Pressable></View><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Verified alerts</Text><Text style={styles.sectionMeta}>{alerts.length} available</Text></View>{alerts.map((alert) => <AlertCard key={alert.id} alert={alert} />)}{outbox.length > 0 && <View style={styles.outboxCard}><Text style={styles.outboxTitle}>Emergency request status</Text>{outbox.slice(0, 2).map((item) => <View key={item.localId} style={styles.outboxRow}><Text style={styles.outboxType}>{item.emergencyType}</Text><Text style={styles.outboxStatus}>{item.deliveryState}</Text></View>)}</View>}</ScrollView>;
}

function MapScreen({ centers }: { centers: EvacuationCenter[] }) {
  return <ScrollView contentContainerStyle={styles.screenContent}><ConnectionBanner connectivity="offline" lastSyncAt={new Date().toISOString()} /><View style={styles.mapCard}><Text style={styles.sectionTitle}>Risk and evacuation map</Text><Text style={styles.sectionMeta}>Cached local map snapshot</Text><View style={styles.mapMock}><View style={styles.floodPolygon} /><View style={[styles.mapRoad, { transform: [{ rotate: "-18deg" }] }]} /><View style={[styles.mapRoad, { top: 180, left: 80, width: 180, transform: [{ rotate: "55deg" }] }]}><View /></View><View style={styles.mapLegend}><Text style={styles.legendText}>● Flood risk</Text><Text style={[styles.legendText, { color: "#0d9488" }]}>● Open center</Text></View>{centers.slice(0, 3).map((center, index) => <View key={center.id} style={[styles.mapPin, { left: 42 + index * 92, top: 132 + (index % 2) * 55 }]}><Text style={styles.mapPinText}>⌂</Text></View>)}</View></View><Text style={styles.offlineHint}>Routing decisions must be refreshed when a new hazard polygon is verified. Cached information is still useful for orientation.</Text></ScrollView>;
}

function CentersScreen({ centers, onRoute }: { centers: EvacuationCenter[]; onRoute: (center: EvacuationCenter) => void }) {
  return <ScrollView contentContainerStyle={styles.screenContent}><ConnectionBanner connectivity="online" lastSyncAt={new Date().toISOString()} /><Text style={styles.sectionTitle}>Evacuation centers</Text><Text style={styles.sectionMeta}>Choose an open shelter with remaining capacity.</Text>{centers.map((center) => { const ratio = Math.min(1, center.occupancy_current / Math.max(1, center.capacity_total)); return <View style={styles.centerCard} key={center.id}><View style={styles.centerCardTop}><View style={{ flex: 1 }}><Text style={styles.centerName}>{center.name}</Text><Text style={styles.centerBarangay}>{center.barangay}</Text></View><Text style={[styles.centerStatus, { color: center.status === "open" ? "#15803d" : "#a16207" }]}>{center.status}</Text></View><View style={styles.capacityTrack}><View style={[styles.capacityProgress, { width: `${ratio * 100}%`, backgroundColor: ratio > .75 ? "#f97316" : "#0d9488" }]} /></View><Text style={styles.capacityText}>{center.occupancy_current} of {center.capacity_total} places used · {center.amenities.join(" · ")}</Text><Pressable style={styles.routeButton} onPress={() => onRoute(center)}><Text style={styles.routeButtonText}>Preview safe route</Text></Pressable></View>; })}</ScrollView>;
}

function ToolkitScreen() {
  return <ScrollView contentContainerStyle={styles.screenContent}><ConnectionBanner connectivity="offline" lastSyncAt={null} /><Text style={styles.sectionTitle}>Offline emergency toolkit</Text><Text style={styles.sectionMeta}>Available without data signal or power.</Text>{[
    ["First aid", "Control bleeding with direct pressure. Cover the wound with a clean cloth and seek medical help."],
    ["Go-bag checklist", "Water, medicines, identification, flashlight, battery radio, whistle, and essential documents."],
    ["Emergency hotlines", "Keep the LGU DRRM desk, health center, police, fire, and rescue contacts written down."],
  ].map(([title, body]) => <View key={title} style={styles.toolCard}><Text style={styles.toolTitle}>{title}</Text><Text style={styles.toolBody}>{body}</Text><Text style={styles.toolLink}>Open offline guide →</Text></View>)}</ScrollView>;
}

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [connectivity, setConnectivity] = useState<Connectivity>("offline");
  const [snapshot, setSnapshot] = useState<CachedSnapshot>({ alerts: [], centers: [], lastSyncAt: null });
  const [outbox, setOutbox] = useState<SosOutboxItem[]>([]);
  const [location, setLocation] = useState<LocationFix | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    readSnapshot().then((value) => active && setSnapshot(value));
    readOutbox().then((value) => active && setOutbox(value));
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => setConnectivity(state.isConnected ? "online" : "offline"));
    setLoading(false);
    return () => { active = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (connectivity !== "online") return;
    let active = true;
    const synchronize = async () => {
      try {
        const value = await refreshSnapshot();
        if (active) {
          setSnapshot(value);
          await writeSnapshot(value);
        }
      } catch {
        // Keep the last verified local snapshot when the network is intermittent.
      }
      const current = await readOutbox();
      for (const queued of current.filter((item) => item.deliveryState === "queued" || item.deliveryState === "failed")) {
        if (!active) return;
        try {
          await updateOutboxItem(queued.localId, { deliveryState: "sending" });
          const response = await submitSosOnline(queued);
          await updateOutboxItem(queued.localId, { deliveryState: "sent", serverSosId: response.id, lastErrorCode: undefined });
        } catch (error) {
          await updateOutboxItem(queued.localId, {
            deliveryState: "failed",
            retryCount: queued.retryCount + 1,
            lastErrorCode: error instanceof Error ? error.message : "network_error",
          });
        }
      }
      if (active) setOutbox(await readOutbox());
    };
    void synchronize();
    return () => { active = false; };
  }, [connectivity]);

  const locate = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") throw new Error("Location permission is required to send a precise SOS.");
    const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: result.coords.latitude, longitude: result.coords.longitude, accuracy: result.coords.accuracy, capturedAt: new Date().toISOString() };
  };

  const createSos = async (transport: "internet" | "sms") => {
    let queuedItem: SosOutboxItem | null = null;
    try {
      const nextLocation = location || await locate();
      setLocation(nextLocation);
      const item: SosOutboxItem = {
        localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        nonce: Math.random().toString(36).slice(2, 8),
        devicePublicId: DEVICE_PUBLIC_ID,
        emergencyType: "TRAPPED",
        shortMessage: "Resident requested emergency assistance.",
        location: nextLocation,
        clientOccurredAt: new Date().toISOString(),
        deliveryState: "queued",
        retryCount: 0,
      };
      queuedItem = item;
      await enqueueSos(item);
      setOutbox((current) => [...current, item]);
      if (transport === "internet" && connectivity === "online") {
        await updateOutboxItem(item.localId, { deliveryState: "sending" });
        const response = await submitSosOnline(item);
        await updateOutboxItem(item.localId, { deliveryState: "sent", serverSosId: response.id });
        setOutbox((current) => current.map((value) => value.localId === item.localId ? { ...value, deliveryState: "sent", serverSosId: response.id } : value));
        RNAlert.alert("SOS sent", "The LGU API accepted your emergency request. Keep your phone available.");
      } else {
        if (!LGU_SMS_NUMBER) throw new Error("EXPO_PUBLIC_LGU_SMS_NUMBER is not configured.");
        const payload = encodeSmsPayload(item);
        await handoffToSms(item, LGU_SMS_NUMBER);
        await updateOutboxItem(item.localId, { deliveryState: "sent" });
        setOutbox((current) => current.map((value) => value.localId === item.localId ? { ...value, deliveryState: "sent" } : value));
        RNAlert.alert("SOS handed to SMS", `Keep this reference if asked: ${payload.slice(0, 28)}…`);
      }
    } catch (error) {
      if (queuedItem) {
        await updateOutboxItem(queuedItem.localId, {
          deliveryState: "failed",
          retryCount: queuedItem.retryCount + 1,
          lastErrorCode: error instanceof Error ? error.message : "delivery_failed",
        });
        setOutbox((current) => current.map((value) => value.localId === queuedItem?.localId ? { ...value, deliveryState: "failed", retryCount: value.retryCount + 1, lastErrorCode: error instanceof Error ? error.message : "delivery_failed" } : value));
      }
      RNAlert.alert("SOS not delivered", error instanceof Error ? error.message : "Try again or use an emergency hotline from the offline toolkit.");
    }
  };

  const openSos = () => RNAlert.alert("Request emergency help", "Your location and emergency type will be sent to the LGU. Choose a transport.", [
    { text: "Cancel", style: "cancel" },
    { text: connectivity === "online" ? "Send online" : "Use SMS", onPress: () => createSos(connectivity === "online" ? "internet" : "sms") },
    ...(connectivity === "online" ? [{ text: "Use SMS", onPress: () => createSos("sms") }] : []),
  ]);

  const route = async (center: EvacuationCenter) => {
    try {
      const nextLocation = location || await locate();
      setLocation(nextLocation);
      const result = await getSafeRoute(nextLocation);
      RNAlert.alert("Safe route preview", `${result.center_name} · ${Math.round(result.distance_meters)} m · about ${Math.ceil(result.estimated_seconds / 60)} minutes.`);
    } catch (error) {
      RNAlert.alert("Route unavailable", error instanceof Error ? error.message : "Use the cached center information and follow local instructions.");
    }
  };

  const content = useMemo(() => {
    if (tab === "map") return <MapScreen centers={snapshot.centers} />;
    if (tab === "centers") return <CentersScreen centers={snapshot.centers} onRoute={route} />;
    if (tab === "toolkit") return <ToolkitScreen />;
    return <HomeScreen alerts={snapshot.alerts} outbox={outbox} connectivity={connectivity} lastSyncAt={snapshot.lastSyncAt} onSos={openSos} />;
  }, [connectivity, outbox, snapshot, tab]);

  if (loading) return <SafeAreaView style={styles.loading}><ActivityIndicator color="#0d9488" /><Text style={styles.loadingText}>Loading offline safety tools…</Text></SafeAreaView>;

  return <SafeAreaView style={styles.app}><View style={styles.header}><View><Text style={styles.headerKicker}>CODE FOR RESILIENCE</Text><Text style={styles.headerTitle}>Balangiga safety</Text></View><View style={styles.headerBadge}><Text style={styles.headerBadgeText}>{connectivity === "online" ? "LIVE" : "OFFLINE"}</Text></View></View><View style={styles.content}>{content}</View><View style={styles.tabBar}>{(["home", "map", "centers", "toolkit"] as Tab[]).map((item) => <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.activeTab]}><Text style={[styles.tabIcon, tab === item && styles.activeTabText]}>{item === "home" ? "⌂" : item === "map" ? "⌖" : item === "centers" ? "▦" : "▤"}</Text><Text style={[styles.tabText, tab === item && styles.activeTabText]}>{item === "centers" ? "Evacuate" : item[0].toUpperCase() + item.slice(1)}</Text></Pressable>)}</View></SafeAreaView>;
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: "#f3f8fa" },
  content: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 15, paddingBottom: 13, backgroundColor: "#102a43", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerKicker: { color: "#7dd3fc", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  headerTitle: { color: "#ffffff", fontSize: 21, fontWeight: "800", marginTop: 3 },
  headerBadge: { backgroundColor: "#1e4f68", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  headerBadgeText: { color: "#a7f3d0", fontSize: 10, fontWeight: "800" },
  screenContent: { padding: 18, paddingBottom: 30 },
  connectionBanner: { backgroundColor: "#dff7f2", borderRadius: 11, padding: 10, flexDirection: "row", alignItems: "center", marginBottom: 15 },
  offlineBanner: { backgroundColor: "#fff7ed" },
  statusDot: { width: 8, height: 8, borderRadius: 8, backgroundColor: "#0d9488", marginRight: 8 },
  offlineDot: { backgroundColor: "#f97316" },
  connectionText: { fontSize: 11, color: "#315a62", fontWeight: "600" },
  hero: { backgroundColor: "#12304a", borderRadius: 20, padding: 20, marginBottom: 20, overflow: "hidden" },
  eyebrow: { color: "#7dd3fc", fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  heroTitle: { color: "#fff", fontSize: 27, lineHeight: 32, fontWeight: "800", marginTop: 8 },
  heroCopy: { color: "#c9d8e5", fontSize: 13, lineHeight: 19, marginTop: 9, maxWidth: 300 },
  sosButton: { marginTop: 20, backgroundColor: "#e11d48", borderRadius: 16, paddingVertical: 16, alignItems: "center", shadowColor: "#881337", shadowOpacity: .35, shadowRadius: 9, elevation: 5 },
  sosButtonLabel: { color: "#fff", fontSize: 30, fontWeight: "900", letterSpacing: 2 },
  sosButtonSub: { color: "#ffe4e6", fontSize: 11, marginTop: 2 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { color: "#102a43", fontSize: 18, fontWeight: "800" },
  sectionMeta: { color: "#627d98", fontSize: 11, marginTop: 4, marginBottom: 12 },
  alertCard: { backgroundColor: "#fff", borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: "#e1eaf0" },
  alertRow: { flexDirection: "row" },
  severityBar: { width: 4, borderRadius: 4, marginRight: 11 },
  alertTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  alertTitle: { color: "#102a43", fontSize: 13, fontWeight: "800", flex: 1 },
  severityLabel: { textTransform: "uppercase", fontSize: 9, fontWeight: "800" },
  alertBody: { color: "#486581", fontSize: 12, lineHeight: 17, marginTop: 6 },
  sourceLabel: { color: "#829ab1", fontSize: 10, marginTop: 8 },
  outboxCard: { backgroundColor: "#ecfeff", borderRadius: 14, padding: 14, marginTop: 6 },
  outboxTitle: { color: "#155e75", fontSize: 12, fontWeight: "800", marginBottom: 6 },
  outboxRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  outboxType: { color: "#164e63", fontSize: 12, fontWeight: "700" },
  outboxStatus: { color: "#0e7490", fontSize: 11, textTransform: "uppercase", fontWeight: "800" },
  mapCard: { backgroundColor: "#fff", borderRadius: 16, padding: 15, borderWidth: 1, borderColor: "#e1eaf0" },
  mapMock: { height: 330, borderRadius: 14, marginTop: 7, overflow: "hidden", backgroundColor: "#cfe8e7", position: "relative" },
  floodPolygon: { position: "absolute", width: 230, height: 118, backgroundColor: "rgba(225, 29, 72, .22)", borderWidth: 2, borderColor: "rgba(225,29,72,.6)", borderRadius: 70, top: 38, left: 22, transform: [{ rotate: "-10deg" }] },
  mapRoad: { position: "absolute", top: 130, left: -30, width: 420, height: 5, borderRadius: 9, backgroundColor: "rgba(255,255,255,.9)" },
  mapLegend: { position: "absolute", bottom: 12, left: 12, right: 12, backgroundColor: "rgba(255,255,255,.92)", borderRadius: 8, padding: 9, flexDirection: "row", justifyContent: "space-around" },
  legendText: { color: "#be123c", fontSize: 10, fontWeight: "700" },
  mapPin: { position: "absolute", width: 28, height: 28, borderRadius: 20, backgroundColor: "#0d9488", borderWidth: 3, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  mapPinText: { color: "#fff", fontWeight: "900" },
  offlineHint: { backgroundColor: "#fff7ed", color: "#9a3412", borderRadius: 12, padding: 12, fontSize: 12, lineHeight: 17, marginTop: 13 },
  centerCard: { backgroundColor: "#fff", borderRadius: 14, padding: 15, marginBottom: 11, borderWidth: 1, borderColor: "#e1eaf0" },
  centerCardTop: { flexDirection: "row", justifyContent: "space-between" },
  centerName: { fontSize: 14, fontWeight: "800", color: "#102a43" },
  centerBarangay: { fontSize: 11, color: "#627d98", marginTop: 3 },
  centerStatus: { textTransform: "uppercase", fontSize: 10, fontWeight: "800" },
  capacityTrack: { height: 7, backgroundColor: "#e5e7eb", borderRadius: 10, marginTop: 14, overflow: "hidden" },
  capacityProgress: { height: "100%", borderRadius: 10 },
  capacityText: { color: "#627d98", fontSize: 10, marginTop: 7 },
  routeButton: { marginTop: 13, backgroundColor: "#e6fffa", borderRadius: 8, padding: 9, alignItems: "center" },
  routeButtonText: { color: "#0f766e", fontSize: 11, fontWeight: "800" },
  toolCard: { backgroundColor: "#fff", borderRadius: 14, padding: 15, marginBottom: 11, borderWidth: 1, borderColor: "#e1eaf0" },
  toolTitle: { color: "#102a43", fontSize: 14, fontWeight: "800" },
  toolBody: { color: "#486581", fontSize: 12, lineHeight: 18, marginTop: 7 },
  toolLink: { color: "#0d9488", fontSize: 11, fontWeight: "800", marginTop: 11 },
  tabBar: { height: 72, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e1eaf0", flexDirection: "row", justifyContent: "space-around", paddingTop: 8 },
  tab: { alignItems: "center", paddingHorizontal: 9, minWidth: 62 },
  activeTab: { backgroundColor: "#e6fffa", borderRadius: 10 },
  tabIcon: { color: "#829ab1", fontSize: 20 },
  tabText: { color: "#829ab1", fontSize: 10, fontWeight: "700", marginTop: 3 },
  activeTabText: { color: "#0f766e" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f3f8fa" },
  loadingText: { color: "#627d98", marginTop: 10, fontSize: 12 },
});
