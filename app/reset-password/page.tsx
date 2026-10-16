import { AuthPage, type AuthSearchParams } from "../components/auth-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Choose a password", robots: { index: false, follow: false } };

export default function Page({ searchParams }: { searchParams: AuthSearchParams }) {
  return <AuthPage mode="reset" searchParams={searchParams} />;
}
