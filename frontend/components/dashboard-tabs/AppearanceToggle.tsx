export type AppearanceMode = "dark" | "light";

export function AppearanceToggle({ appearance, onAppearanceChange, className = "" }: { appearance: AppearanceMode; onAppearanceChange: () => void; className?: string }) {
  const targetMode = appearance === "dark" ? "light" : "dark";
  return <button className={`appearance-toggle ${className}`.trim()} type="button" onClick={onAppearanceChange} aria-pressed={appearance === "dark"} aria-label={`Switch to ${targetMode} mode`} title={`Switch to ${targetMode} mode`}><span aria-hidden="true">{appearance === "dark" ? "☀" : "☾"}</span><b>{targetMode === "light" ? "Light" : "Dark"}</b></button>;
}
