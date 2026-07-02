import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { admin } from "better-auth/plugins/admin";
import { magicLink } from "better-auth/plugins/magic-link";
import { PRODUCT_NAME } from "@/config/platform";
import * as schema from "@/db/schema";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { enqueueEmail } from "@/lib/email";
import { magicLinkTemplate } from "@/lib/email/templates/magic-link";
import { env } from "@/lib/env";
import { getPlatformSettings } from "@/lib/settings";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  secret: env.APP_SECRET,
  baseURL: env.NEXT_PUBLIC_APP_URL,
  emailAndPassword: {
    enabled: true,
    // Self-hosted installs may not have SMTP configured yet — password login
    // must work as a zero-dependency bootstrap path (see scripts/create-admin.ts).
    requireEmailVerification: false,
    minPasswordLength: 8,
  },
  socialProviders: {
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },
  plugins: [
    admin({
      impersonationSessionDuration: 3600,
      allowImpersonatingAdmins: false,
    }),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        const { html, text } = await magicLinkTemplate({
          email,
          magicLinkUrl: url,
        });

        await enqueueEmail({
          to: email,
          subject: `Sign in to ${PRODUCT_NAME}`,
          html,
          text,
        });

        await audit({
          action: "auth.magic_link_sent",
          actorEmail: email,
          description: `Magic link sent to ${email}`,
          entityType: "user",
          metadata: { email },
        });
      },
    }),
  ],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60,
    },
  },
  hooks: {
    // Enforce the admin-configured sign-in method toggles server-side — not
    // just hiding the button in the UI — so a disabled method can't be used
    // by posting directly to the API.
    before: createAuthMiddleware(async (ctx) => {
      const isPasswordSignIn = ctx.path === "/sign-in/email";
      const isMagicLinkRequest = ctx.path === "/sign-in/magic-link";
      const isSocialSignIn = ctx.path === "/sign-in/social";
      if (!(isPasswordSignIn || isMagicLinkRequest || isSocialSignIn)) {
        return;
      }

      const settings = await getPlatformSettings();
      if (isPasswordSignIn && !settings.passwordLoginEnabled) {
        throw new APIError("FORBIDDEN", {
          message: "Password sign-in is disabled.",
        });
      }
      if (isMagicLinkRequest && !settings.magicLinkEnabled) {
        throw new APIError("FORBIDDEN", {
          message: "Magic link sign-in is disabled.",
        });
      }
      if (isSocialSignIn && !settings.googleLoginEnabled) {
        throw new APIError("FORBIDDEN", {
          message: "Google sign-in is disabled.",
        });
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await audit({
            action: "user.created",
            actorEmail: user.email,
            actorId: user.id,
            description: `User created: ${user.email}`,
            entityId: user.id,
            entityType: "user",
          });
        },
      },
    },
  },
});
