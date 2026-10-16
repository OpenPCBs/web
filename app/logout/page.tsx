import { SignOutButton } from "../components/auth-form";
import { SiteHeader, SiteFooter } from "../components/site-shell";
import "../auth.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign out", robots: { index: false, follow: false } };
export default function Page() {
 return <><SiteHeader /><main id="main-content" className="auth-layout"><section className="auth-card"><h1>Sign out of Trace?</h1><p className="auth-intro">Your orders and saved work will be here when you return.</p><SignOutButton /><p><a href="/account">Back to my account</a></p></section></main><SiteFooter /></>;
}
