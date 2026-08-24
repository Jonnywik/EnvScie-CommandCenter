import type { ReactNode } from "react";
import { AppearanceToggle, type AppearanceMode } from "./AppearanceToggle";

type HeaderIdentityProps = {
  context: string;
  timeLabel?: string;
  timeDateTime?: string;
  className?: string;
};

export function CommandCenterHeaderIdentity({ context, timeLabel, timeDateTime, className = "" }: HeaderIdentityProps) {
  return <div className={`command-center-header-brand ${className}`.trim()}>
    <img src="/cfr-reference-emblem.png" alt="EnvScie CommandCenter emblem" />
    <div><strong>EnvScie CommandCenter</strong><span>{context}</span></div>
    {timeLabel && <time dateTime={timeDateTime}>{timeLabel}</time>}
  </div>;
}

export function CommandCenterHeader({
  title,
  context,
  appearance,
  onAppearanceChange,
  operatorLabel = "Operational session",
  syncLabel = "Last verified sync · current snapshot",
  connection = "live",
  actions,
  onReturn,
  returnLabel = "Command Map",
  className = "",
}: {
  title: string;
  context: string;
  appearance: AppearanceMode;
  onAppearanceChange: () => void;
  operatorLabel?: string;
  syncLabel?: string;
  connection?: "live" | "cached" | "attention";
  actions?: ReactNode;
  onReturn?: () => void;
  returnLabel?: string;
  className?: string;
}) {
  const connectionLabel = connection === "live" ? "Live operations" : connection === "cached" ? "Cached snapshot" : "Review required";
  const initials = operatorLabel.split(/[·\s]+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "DO";
  return <header className={`command-center-header ${className}`.trim()}>
    <CommandCenterHeaderIdentity context={context} />
    <div className="command-center-header-workspace"><span>WORKSPACE</span><h1>{title}</h1></div>
    <div className="command-center-header-status"><span className={`command-center-connection ${connection}`}><i aria-hidden="true" />{connectionLabel}</span><span className="command-center-sync">{syncLabel}</span></div>
    <div className="command-center-header-actions">
      {actions}
      {onReturn && <button type="button" onClick={onReturn} className="command-center-return">← {returnLabel}</button>}
      <AppearanceToggle appearance={appearance} onAppearanceChange={onAppearanceChange} className="workspace-appearance-toggle" />
      <span className="command-center-avatar" aria-label={operatorLabel} title={operatorLabel}>{initials}</span>
    </div>
  </header>;
}
