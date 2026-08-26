import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import { Radio, WifiOff } from "lucide-react";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import MapLocator from "./pages/MapLocator";
import ReportIncident from "./pages/ReportIncident";
import Prepare from "./pages/Prepare";
import Operations from "./pages/Operations";
import Alerts from "./pages/Alerts";
import VolunteerOnboarding from "./pages/VolunteerOnboarding";
import Settings from "./pages/Settings";
import EmergencyPlan from "./pages/EmergencyPlan";
import CrisisMap from "./pages/CrisisMap";
import Directions from "./pages/Directions";
import SosRequest from "./pages/SosRequest";
import CommandCenter from "./pages/CommandCenter";
import EmergencyCircle from "./pages/EmergencyCircle";
import { LocaleProvider, useLocale } from "./contexts/LocaleContext";
import { AccessibilityProvider } from "./contexts/AccessibilityContext";
import { CrisisMapProvider } from "./contexts/CrisisMapContext";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/map"} component={MapLocator} />
      <Route path={"/crisis-map"} component={CrisisMap} />
      <Route path={"/directions"} component={Directions} />
      <Route path={"/report"} component={ReportIncident} />
      <Route path={"/sos"} component={SosRequest} />
      <Route path={"/circle"} component={EmergencyCircle} />
      <Route path={"/prepare"} component={Prepare} />
      <Route path={"/ops"} component={CommandCenter} />
      <Route path={"/ops/management"} component={Operations} />
      <Route path={"/alerts"} component={Alerts} />
      <Route path={"/volunteer"} component={VolunteerOnboarding} />
      <Route path={"/settings"} component={Settings} />
      <Route path={"/plan"} component={EmergencyPlan} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

const readinessCopy = {
  en: { onlineTitle: "Offline-ready", onlineBody: "Emergency tools stay available on this device.", offlineTitle: "Offline mode active", offlineBody: "Saved emergency tools remain ready on this device." },
  fil: { onlineTitle: "Handa offline", onlineBody: "Mananatiling available ang emergency tools sa device na ito.", offlineTitle: "Aktibo ang offline mode", offlineBody: "Handa pa rin sa device na ito ang naka-save na emergency tools." },
  war: { onlineTitle: "Andam offline", onlineBody: "Aada la gihapon hini nga device an emergency tools.", offlineTitle: "Aktibo an offline mode", offlineBody: "Andam la gihapon hini nga device an nasave nga emergency tools." },
} as const;

function OfflineReadyIndicator() {
  const { locale } = useLocale();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [visible, setVisible] = useState(false);
  const copy = readinessCopy[locale];

  useEffect(() => {
    const reveal = window.setTimeout(() => setVisible(true), 380);
    const markOnline = () => setOnline(true);
    const markOffline = () => setOnline(false);
    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    return () => {
      window.clearTimeout(reveal);
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
    };
  }, []);

  if (!visible) return null;
  const title = online ? copy.onlineTitle : copy.offlineTitle;
  const body = online ? copy.onlineBody : copy.offlineBody;
  const Icon = online ? Radio : WifiOff;

  return <div className="pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[70] flex justify-center sm:bottom-5"><div className="drrm-offline-ready flex max-w-sm items-center gap-3 rounded-2xl border border-[#b8ded4] bg-[#ecfaf5]/95 px-4 py-3 text-[#0b594c] shadow-[0_12px_32px_rgba(6,52,72,0.16)] backdrop-blur" role="status" aria-live="polite"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${online ? "bg-[#bfe9dc]" : "bg-[#ffe2c8] text-[#8a4619]"}`}><Icon className="h-4 w-4" aria-hidden="true"/></span><span><span className="block text-sm font-extrabold leading-5">{title}</span><span className="block text-xs font-semibold leading-5 text-[#47736e]">{body}</span></span></div></div>;
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        switchable
      >
        <LocaleProvider><AccessibilityProvider><CrisisMapProvider><div className="drrm-app-load min-h-screen"><TooltipProvider><Toaster /><Router /><OfflineReadyIndicator /></TooltipProvider></div></CrisisMapProvider></AccessibilityProvider></LocaleProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
