"use client";

import dynamic from "next/dynamic";

function LoadingFallback() {
  return (
    <main className="loading-screen" aria-busy="true" aria-live="polite">
      <section className="loading-card">
        <div className="loading-emblem-wrap">
          <span className="loading-halo" aria-hidden="true" />
          <img
            className="loading-emblem"
            src="/cfr-reference-emblem.png"
            alt="Code for Resilience resilience emblem"
            width="90"
            height="90"
          />
        </div>
        <div className="eyebrow">Code for Resilience</div>
        <h1>Balangiga command center</h1>
        <p className="loading-copy">Preparing operational view.</p>
        <div className="loading-progress" aria-hidden="true"><span style={{ width: "32%" }} /></div>
        <div className="loading-step">
          <span className="loading-step-dot" />
          Connecting
          <span className="loading-ellipsis" aria-hidden="true">…</span>
        </div>
        <div className="loading-footer">
          <span className="health-dot" />
          Offline-ready
        </div>
      </section>
    </main>
  );
}

const Dashboard = dynamic(() => import("./Dashboard"), {
  ssr: false,
  loading: () => <LoadingFallback />,
});

export default function DashboardClient() {
  return <Dashboard />;
}
