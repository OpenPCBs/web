import { AuthPage, type AuthSearchParams } from "../components/auth-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reset password", robots: { index: false, follow: false } };

export default function Page({ searchParams }: { searchParams: AuthSearchParams }) {
  return <AuthPage mode="forgot" searchParams={searchParams} />;
}
