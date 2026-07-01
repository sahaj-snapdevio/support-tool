import { redirect } from "next/navigation";
import { AuthForm } from "@/app/(auth)/_components/auth-form";
import { PRODUCT_NAME } from "@/config/platform";
import { getCurrentSession } from "@/lib/authz";

export const metadata = {
  title: `Sign in · ${PRODUCT_NAME}`,
};

export default async function LoginPage() {
  const session = await getCurrentSession();
  if (session) redirect("/post-auth");

  const googleEnabled = !!(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
  return <AuthForm googleEnabled={googleEnabled} />;
}
