import {
  EMAIL_TEMPLATE_TYPES,
  getAllEmailTemplates,
} from "@/lib/email-templates";
import { textToRichTextJson } from "@/lib/rich-text";
import { getPlatformSettings } from "@/lib/settings";
import { EmailTemplatesSection } from "./_components/email-templates-section";

export const metadata = { title: "Email Templates" };

export default async function EmailTemplatesPage() {
  const [rows, settings] = await Promise.all([
    getAllEmailTemplates(),
    getPlatformSettings(),
  ]);

  const templates = EMAIL_TEMPLATE_TYPES.map((meta) => ({
    type: meta.type,
    label: meta.label,
    description: meta.description,
    defaultSubject: meta.defaultSubject,
    defaultBody: textToRichTextJson(meta.defaultBody),
    gatedByTicketToggle: meta.gatedByTicketToggle,
    mergeTags: meta.mergeTags,
    subject: rows[meta.type]?.subject ?? null,
    body: rows[meta.type]?.body ?? null,
  }));

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">
          Email Templates
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Customize the subject and body of each customer-facing email. Leave a
          template untouched to keep Support Tool's default design.
        </p>
      </div>
      <EmailTemplatesSection
        initialTemplates={templates}
        initialTicketEmailNotificationsEnabled={
          settings.ticketEmailNotificationsEnabled
        }
      />
    </div>
  );
}
