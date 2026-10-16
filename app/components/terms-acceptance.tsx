"use client";

export function TermsAcceptance({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="terms-acceptance"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>I agree to the <a href="/legal/terms" target="_blank" rel="noopener noreferrer">Terms of use</a> and have reviewed the <a href="/legal/returns" target="_blank" rel="noopener noreferrer">Returns</a>, <a href="/legal/shipping" target="_blank" rel="noopener noreferrer">Shipping</a>, and <a href="/legal/privacy" target="_blank" rel="noopener noreferrer">Privacy</a> notices.</span></label>;
}
