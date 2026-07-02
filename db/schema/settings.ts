import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const platformSettings = pgTable("platform_settings", {
  id: text("id").primaryKey().default("default"),
  theme: text("theme").notNull().default("default"),
  appearanceMode: text("appearance_mode").notNull().default("auto"),
  // Per-method sign-in toggles. Google also requires env credentials to be
  // configured regardless of this flag — this only lets an admin turn it off.
  passwordLoginEnabled: boolean("password_login_enabled").notNull().default(true),
  magicLinkEnabled: boolean("magic_link_enabled").notNull().default(true),
  googleLoginEnabled: boolean("google_login_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
