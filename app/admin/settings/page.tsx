"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Check, Copy, KeyRound, LoaderCircle, PlugZap, Save, ShieldCheck, Webhook } from "lucide-react";
import { adminRequest, errorMessage, shortDateTime } from "../admin-api";
import { ErrorState, LoadingState, PageHeading, StatusBadge } from "../admin-components";
import type { StoreSettings, StripeSettings } from "../admin-types";

type StripeDraft = {
  secretKey: string;
  webhookSecret: string;
  clearSecretKey: boolean;
  clearWebhookSecret: boolean;
};

type StoreDraft = {
  name: string;
  supportEmail: string;
  currency: string;
  publicOrigin: string;
  checkoutEnabled: boolean;
  allowedShippingCountries: string;
  flatShipping: string;
  automaticTaxEnabled: boolean;
};

const emptyStripeDraft: StripeDraft = { secretKey: "", webhookSecret: "", clearSecretKey: false, clearWebhookSecret: false };

export default function SettingsPage() {
  const [stripe, setStripe] = useState<StripeSettings | null>(null);
  const [stripeDraft, setStripeDraft] = useState<StripeDraft>(emptyStripeDraft);
  const [storeDraft, setStoreDraft] = useState<StoreDraft | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("/api/stripe/webhook");
  const [loading, setLoading] = useState(true);
  const [savingStripe, setSavingStripe] = useState(false);
  const [savingStore, setSavingStore] = useState(false);
  const [testing, setTesting] = useState(false);
  const [configuringWebhook, setConfiguringWebhook] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [stripeResponse, storeResponse] = await Promise.all([
        adminRequest<{ stripe: StripeSettings }>("/api/admin/settings/stripe"),
        adminRequest<{ store: StoreSettings }>("/api/admin/settings/store"),
      ]);
      setStripe(stripeResponse.stripe);
      const nextStore = toStoreDraft(storeResponse.store);
      if (!nextStore.publicOrigin && typeof window !== "undefined") {
        nextStore.publicOrigin = window.location.origin;
      }
      setStoreDraft(nextStore);
      if (storeResponse.store.publicOrigin) setWebhookUrl(`${storeResponse.store.publicOrigin.replace(/\/$/, "")}/api/stripe/webhook`);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setWebhookUrl(`${window.location.origin}/api/stripe/webhook`); }, []);

  async function saveStripe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      ...(stripeDraft.secretKey.trim() ? { secretKey: stripeDraft.secretKey.trim() } : {}),
      ...(stripeDraft.webhookSecret.trim() ? { webhookSecret: stripeDraft.webhookSecret.trim() } : {}),
      ...(stripeDraft.clearSecretKey ? { clearSecretKey: true } : {}),
      ...(stripeDraft.clearWebhookSecret ? { clearWebhookSecret: true } : {}),
    };
    if (!Object.keys(payload).length) { setError("Enter a new secret or choose a stored secret to clear."); return; }
    setSavingStripe(true);
    setError("");
    setNotice("");
    try {
      const response = await adminRequest<{ stripe: StripeSettings }>("/api/admin/settings/stripe", { method: "PATCH", body: JSON.stringify(payload) });
      setStripe(response.stripe);
      setStripeDraft(emptyStripeDraft);
      setNotice("Stripe settings saved. Secret values remain masked and cannot be read back.");
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSavingStripe(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setError("");
    setNotice("");
    try {
      const response = await adminRequest<{ ok: boolean; account?: { id?: string; business_profile?: { name?: string } } }>("/api/admin/settings/stripe/test", { method: "POST", body: "{}" });
      setNotice(response.ok ? `Stripe connection succeeded${response.account?.id ? ` for ${response.account.id}` : ""}.` : "Stripe returned an unexpected response.");
      await load();
    } catch (testError) {
      setError(errorMessage(testError));
    } finally {
      setTesting(false);
    }
  }

  async function configureWebhook() {
    setConfiguringWebhook(true);
    setError("");
    setNotice("");
    try {
      const response = await adminRequest<{ webhook: { configured: true; endpointId: string; url: string; enabledEvents: string[]; reused: boolean }; stripe: StripeSettings }>("/api/admin/settings/stripe/webhook", { method: "POST", body: "{}" });
      setStripe(response.stripe);
      setWebhookUrl(response.webhook.url);
      setNotice(`${response.webhook.reused ? "Reused" : "Created"} Stripe webhook ${response.webhook.endpointId}. The signing secret was stored securely.`);
    } catch (configureError) {
      setError(errorMessage(configureError));
    } finally {
      setConfiguringWebhook(false);
    }
  }

  async function saveStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storeDraft) return;
    const shipping = Number.parseFloat(storeDraft.flatShipping);
    if (!Number.isFinite(shipping) || shipping < 0) { setError("Flat shipping must be a non-negative amount."); return; }
    setSavingStore(true);
    setError("");
    setNotice("");
    try {
      const payload: StoreSettings = {
        storeName: storeDraft.name.trim(),
        supportEmail: storeDraft.supportEmail.trim(),
        currency: storeDraft.currency,
        publicOrigin: storeDraft.publicOrigin.trim().replace(/\/$/, ""),
        checkoutEnabled: storeDraft.checkoutEnabled,
        allowedShippingCountries: storeDraft.allowedShippingCountries.split(",").map((value) => value.trim().toUpperCase()).filter(Boolean),
        flatShippingCents: Math.round(shipping * 100),
        automaticTaxEnabled: storeDraft.automaticTaxEnabled,
      };
      const response = await adminRequest<{ store: StoreSettings }>("/api/admin/settings/store", { method: "PATCH", body: JSON.stringify(payload) });
      setStoreDraft(toStoreDraft(response.store));
      setNotice("Store settings saved.");
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSavingStore(false);
    }
  }

  async function copyWebhook() {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setNotice("Webhook URL copied.");
    } catch {
      setError("Copy was blocked by the browser. Select the URL and copy it manually.");
    }
  }

  return (
    <>
      <PageHeading eyebrow="Platform configuration" title="Settings" description="Configure checkout, fulfillment defaults, and Stripe without exposing stored credentials." />
      {error ? <div className="admin-alert" role="alert">{error}</div> : null}
      {notice ? <div className="admin-alert" data-tone="success" role="status"><Check size={15} /> {notice}</div> : null}
      {loading ? <div className="admin-panel"><LoadingState label="Loading configuration…" /></div> : null}
      {!loading && (!stripe || !storeDraft) && error ? <div className="admin-panel"><ErrorState message={error} onRetry={() => void load()} /></div> : null}
      {!loading && stripe && storeDraft ? (
        <div className="admin-settings-grid">
          <section className="admin-settings-card admin-settings-card--wide">
            <header><div><h2>Stripe setup</h2><p>Write-only secrets, checkout readiness, connection testing, and webhook provisioning.</p></div><StatusBadge value={stripe.checkoutReady ? "configured" : "setup_required"} /></header>
            <div className="admin-config-list">
              <div className="admin-config-row"><span><b>Settings encryption</b><small>Required before browser-entered secrets can be stored</small></span><StatusBadge value={stripe.encryptionKeyConfigured ? "configured" : "setup_required"} /></div>
              <div className="admin-config-row"><span><b>Public origin</b><small>Used for Stripe return URLs and webhook destination</small></span><StatusBadge value={stripe.originConfigured ? "configured" : "setup_required"} /></div>
              <div className="admin-config-row"><span><b>Secret API key</b><small>{stripe.secretKeySource ? `Source: ${stripe.secretKeySource}` : "No source recorded"}</small></span><span className="admin-secret-display">{stripe.secretKeyConfigured ? `•••• ${stripe.secretKeyLast4 ?? "stored"}` : "Not configured"}</span></div>
              <div className="admin-config-row"><span><b>Webhook signing secret</b><small>{stripe.webhookSecretSource ? `Source: ${stripe.webhookSecretSource}` : "No source recorded"}</small></span><span className="admin-secret-display">{stripe.webhookSecretConfigured ? `•••• ${stripe.webhookSecretLast4 ?? "stored"}` : "Not configured"}</span></div>
              <div className="admin-config-row"><span><b>Last connection test</b><small>{shortDateTime(stripe.lastTestedAt)}</small></span><StatusBadge value={stripe.lastTestStatus || "not_tested"} /></div>
            </div>

            <div className="admin-settings-split">
              <form onSubmit={saveStripe}>
                <h3>Update credentials</h3><p className="admin-note">Saved secrets are encrypted or provided by the runtime. Their full values are never returned to this page.</p>
                <div className="admin-form-grid">
                  <label className="admin-field"><span>Stripe secret key</span><input type="password" autoComplete="new-password" value={stripeDraft.secretKey} onChange={(event) => setStripeDraft((current) => ({ ...current, secretKey: event.target.value, clearSecretKey: false }))} placeholder={stripe.secretKeyConfigured ? "Leave blank to keep current key" : "sk_live_… or sk_test_…"} /></label>
                  <label className="admin-field"><span>Webhook signing secret</span><input type="password" autoComplete="new-password" value={stripeDraft.webhookSecret} onChange={(event) => setStripeDraft((current) => ({ ...current, webhookSecret: event.target.value, clearWebhookSecret: false }))} placeholder={stripe.webhookSecretConfigured ? "Leave blank to keep current secret" : "whsec_…"} /></label>
                  {stripe.secretKeyConfigured ? <label className="admin-check-row"><input type="checkbox" checked={stripeDraft.clearSecretKey} onChange={(event) => setStripeDraft((current) => ({ ...current, clearSecretKey: event.target.checked, secretKey: event.target.checked ? "" : current.secretKey }))} /><span>Clear the stored Stripe secret key.</span></label> : <span />}
                  {stripe.webhookSecretConfigured ? <label className="admin-check-row"><input type="checkbox" checked={stripeDraft.clearWebhookSecret} onChange={(event) => setStripeDraft((current) => ({ ...current, clearWebhookSecret: event.target.checked, webhookSecret: event.target.checked ? "" : current.webhookSecret }))} /><span>Clear the stored webhook signing secret.</span></label> : null}
                </div>
                <div className="admin-settings-actions"><button className="admin-button" type="submit" disabled={savingStripe}>{savingStripe ? <LoaderCircle className="admin-spin" size={14} /> : <KeyRound size={14} />}{savingStripe ? "Saving…" : "Save credentials"}</button><button className="admin-button admin-button--secondary" type="button" onClick={() => void testConnection()} disabled={testing || !stripe.secretKeyConfigured}>{testing ? <LoaderCircle className="admin-spin" size={14} /> : <PlugZap size={14} />}{testing ? "Testing…" : "Test connection"}</button></div>
              </form>

              <div className="admin-webhook-guide">
                <h3>Webhook endpoint</h3><p className="admin-note">Automatic setup creates or reuses this endpoint in Stripe and stores the signing secret without showing it in the browser.</p>
                <div className="admin-webhook-box"><code>{webhookUrl}</code><button className="admin-button admin-button--secondary" type="button" onClick={() => void copyWebhook()}><Copy size={13} /> Copy</button></div>
                <button className="admin-button" type="button" disabled={configuringWebhook || !stripe.secretKeyConfigured} onClick={() => void configureWebhook()}>{configuringWebhook ? <LoaderCircle className="admin-spin" size={14} /> : <Webhook size={14} />}{configuringWebhook ? "Configuring…" : "Configure webhook automatically"}</button>
                <div className="admin-divider" />
                <b className="admin-mini-title">Manual fallback</b>
                <ol className="admin-checklist">
                  <li data-done={stripe.secretKeyConfigured || undefined}>Save a Stripe secret key and test the connection.</li>
                  <li>Add the URL above as a Stripe webhook endpoint.</li>
                  <li>Enable <code>checkout.session.completed</code> and <code>checkout.session.async_payment_succeeded</code>.</li>
                  <li data-done={stripe.webhookSecretConfigured || undefined}>Paste the endpoint signing secret into the credential form and save.</li>
                </ol>
              </div>
            </div>
          </section>

          <form className="admin-settings-card" onSubmit={saveStore}>
            <header><div><h2>Store identity</h2><p>Customer-facing name, support address, and default currency.</p></div><ShieldCheck size={20} /></header>
            <div className="admin-form-grid">
              <label className="admin-field admin-field--wide"><span>Store name</span><input required value={storeDraft.name} onChange={(event) => setStoreDraft((current) => current && ({ ...current, name: event.target.value }))} /></label>
              <label className="admin-field admin-field--wide"><span>Support email</span><input required type="email" value={storeDraft.supportEmail} onChange={(event) => setStoreDraft((current) => current && ({ ...current, supportEmail: event.target.value }))} /></label>
              <label className="admin-field admin-field--wide"><span>Public site origin</span><input required type="url" value={storeDraft.publicOrigin} onChange={(event) => setStoreDraft((current) => current && ({ ...current, publicOrigin: event.target.value }))} placeholder="https://example.com" /><small>Used for Stripe return links and webhook setup. Do not include a trailing slash.</small></label>
              <label className="admin-field"><span>Currency</span><select value={storeDraft.currency} onChange={(event) => setStoreDraft((current) => current && ({ ...current, currency: event.target.value }))}><option value="usd">USD</option><option value="cad">CAD</option><option value="eur">EUR</option><option value="gbp">GBP</option></select></label>
              <label className="admin-check-row"><input type="checkbox" checked={storeDraft.checkoutEnabled} onChange={(event) => setStoreDraft((current) => current && ({ ...current, checkoutEnabled: event.target.checked }))} /><span>Allow customers to start checkout.</span></label>
            </div>
            <div className="admin-settings-actions"><button className="admin-button" type="submit" disabled={savingStore}>{savingStore ? <LoaderCircle className="admin-spin" size={14} /> : <Save size={14} />}{savingStore ? "Saving…" : "Save store"}</button></div>
          </form>

          <form className="admin-settings-card" onSubmit={saveStore}>
            <header><div><h2>Shipping and tax</h2><p>Simple defaults used when checkout calculates the order total.</p></div></header>
            <div className="admin-form-grid">
              <label className="admin-field admin-field--wide"><span>Allowed shipping countries</span><input value={storeDraft.allowedShippingCountries} onChange={(event) => setStoreDraft((current) => current && ({ ...current, allowedShippingCountries: event.target.value }))} placeholder="US, CA, GB" /><small>Comma-separated ISO two-letter country codes.</small></label>
              <label className="admin-field"><span>Flat shipping</span><span className="admin-input-prefix"><span>$</span><input inputMode="decimal" value={storeDraft.flatShipping} onChange={(event) => setStoreDraft((current) => current && ({ ...current, flatShipping: event.target.value }))} /></span></label>
              <label className="admin-check-row"><input type="checkbox" checked={storeDraft.automaticTaxEnabled} onChange={(event) => setStoreDraft((current) => current && ({ ...current, automaticTaxEnabled: event.target.checked }))} /><span>Enable Stripe automatic tax for checkout.</span></label>
            </div>
            <div className="admin-settings-actions"><button className="admin-button" type="submit" disabled={savingStore}>{savingStore ? <LoaderCircle className="admin-spin" size={14} /> : <Save size={14} />}{savingStore ? "Saving…" : "Save fulfillment"}</button></div>
          </form>
        </div>
      ) : null}
    </>
  );
}

function toStoreDraft(store: StoreSettings): StoreDraft {
  return {
    name: store.storeName,
    supportEmail: store.supportEmail,
    currency: store.currency,
    publicOrigin: store.publicOrigin ?? "",
    checkoutEnabled: store.checkoutEnabled,
    allowedShippingCountries: store.allowedShippingCountries.join(", "),
    flatShipping: (store.flatShippingCents / 100).toFixed(2),
    automaticTaxEnabled: store.automaticTaxEnabled,
  };
}
