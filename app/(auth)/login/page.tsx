import { redirect } from "next/navigation";
import { AuthForm } from "@/app/(auth)/_components/auth-form";
import { PRODUCT_NAME } from "@/config/platform";
import { getCurrentSession } from "@/lib/authz";
import { getPlatformSettings } from "@/lib/settings";

export const metadata = {
  title: `Sign in · ${PRODUCT_NAME}`,
};

export default async function LoginPage() {
  const session = await getCurrentSession();
  if (session) {
    redirect("/post-auth");
  }

  const settings = await getPlatformSettings();

  const googleConfigured = !!(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );

  return (
    <AuthForm
      googleEnabled={googleConfigured && settings.googleLoginEnabled}
      magicLinkEnabled={settings.magicLinkEnabled}
      passwordLoginEnabled={settings.passwordLoginEnabled}
    />
  );
}
