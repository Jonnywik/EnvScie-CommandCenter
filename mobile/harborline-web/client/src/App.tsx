import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import { LocaleProvider } from "./contexts/LocaleContext";
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
        <LocaleProvider><AccessibilityProvider><CrisisMapProvider><div className="drrm-app-load min-h-screen"><TooltipProvider><Toaster /><Router /></TooltipProvider></div></CrisisMapProvider></AccessibilityProvider></LocaleProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
