import type { Metadata } from "next";
import { chatGPTSignOutPath, requireChatGPTUser } from "../chatgpt-auth";
import { AccountClient } from "../components/account-client";
import { SiteFooter, SiteHeader } from "../components/site-shell";
import "./account.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Workspace",
  description: "Manage your actual Thevenin orders, designs, and verification requests.",
};

type AccountSearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined, maxLength: number): string | undefined {
  const result = Array.isArray(value) ? value[0] : value;
  return result?.trim().slice(0, maxLength) || undefined;
}

export default async function AccountPage({ searchParams }: { searchParams: AccountSearchParams }) {
  const params = await searchParams;
  const checkout = first(params.checkout, 40);
  const sessionId = first(params.session_id, 220);
  const returnTo = `/account${checkout ? `?checkout=${encodeURIComponent(checkout)}${sessionId ? `&session_id=${encodeURIComponent(sessionId)}` : ""}` : ""}`;
  return <AccountGate checkout={checkout} sessionId={sessionId} returnTo={returnTo} />;
}

async function AccountGate({ checkout, sessionId, returnTo }: { checkout?: string; sessionId?: string; returnTo: string }) {
  const user = await requireChatGPTUser(returnTo);

  return (
    <>
      <SiteHeader />
      <AccountClient
        user={{ displayName: user.displayName, email: user.email }}
        checkout={checkout}
        sessionId={sessionId}
        signOutHref={chatGPTSignOutPath("/")}
      />
      <SiteFooter />
    </>
  );
}
