import type { Metadata } from "next";
import { chatGPTSignInPath, getChatGPTUser } from "@/app/chatgpt-auth";
import { SiteFooter, SiteHeader } from "@/app/components/site-shell";
import { CartClient } from "./cart-client";
import styles from "./cart.module.css";

export const metadata: Metadata = {
  title: "Cart",
  description: "Review products saved to your account-backed Thevenin Supply cart.",
};

export const dynamic = "force-dynamic";

type CartSearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function CartPage({ searchParams }: { searchParams: CartSearchParams }) {
  const [user, params] = await Promise.all([getChatGPTUser(), searchParams]);
  const checkoutCancelled = first(params.checkout) === "cancelled";

  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <div className={styles.container}>
          <header className={styles.heading}>
            <span>PROCUREMENT</span>
            <h1>Your cart</h1>
            <p>Review the real products and quantities saved to your signed-in account before secure checkout.</p>
          </header>
          <CartClient
            signedIn={Boolean(user)}
            displayName={user?.displayName ?? null}
            signInHref={chatGPTSignInPath("/cart")}
            checkoutCancelled={checkoutCancelled}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
