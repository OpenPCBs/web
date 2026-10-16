"use client";

import { useEffect, useState } from "react";
import { hasGlobalPrivacyControl, PRIVACY_EVENT, readPrivacyChoice, savePrivacyChoice, type PrivacyChoice } from "@/lib/client/privacy";

export function usePrivacyChoice() {
  const [choice, setChoice] = useState<PrivacyChoice | null>(null);
  const [ready, setReady] = useState(false);
  const [globalControl, setGlobalControl] = useState(false);
  useEffect(() => {
    const update = () => { setChoice(readPrivacyChoice()); setGlobalControl(hasGlobalPrivacyControl()); setReady(true); };
    update();
    window.addEventListener(PRIVACY_EVENT, update);
    window.addEventListener("storage", update);
    return () => { window.removeEventListener(PRIVACY_EVENT, update); window.removeEventListener("storage", update); };
  }, []);
  return { choice, ready, globalControl };
}

export function PrivacyControls({ full = false }: { full?: boolean }) {
  const { choice, ready, globalControl } = usePrivacyChoice();
  if (!full && (!ready || choice || globalControl)) return null;
  return (
    <section className={full ? "privacy-controls" : "privacy-banner"} aria-label="Privacy choices">
      <div>
        <strong>Your privacy choices</strong>
        <p>Trace uses essential sign-in and preference storage. There is no advertising or analytics integration. Optional supplier images and the Ucamco viewer stay blocked until you allow external tools.</p>
        {globalControl ? <p role="status">Global Privacy Control is enabled. External tools are blocked.</p> : null}
        {full && ready ? <p role="status">External tools: {choice?.externalMedia && !globalControl ? "allowed" : "blocked"}. You can change this at any time.</p> : null}
      </div>
      <div className="privacy-actions">
        <button type="button" onClick={() => savePrivacyChoice(false)}>Essential only</button>
        <button type="button" disabled={globalControl} onClick={() => savePrivacyChoice(true)}>Allow external tools</button>
        <a href={full ? "/legal/cookies" : "/privacy/choices"}>{full ? "Cookie & storage notice" : "Manage choices"}</a>
      </div>
    </section>
  );
}

export function ExternalToolGate({ children }: { children: React.ReactNode }) {
  const { choice, ready, globalControl } = usePrivacyChoice();
  if (ready && choice?.externalMedia && !globalControl) return children;
  return <div className="external-tool-gate"><h3>Load the external viewer?</h3><p>Loading Ucamco connects your browser to gerber.ucamco.com and shares connection data such as your IP address. It has its own privacy practices. Files from the local viewer are never transferred automatically.</p><PrivacyControls full /></div>;
}
