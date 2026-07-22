import { EMAIL_TEMPLATE_TYPES, getAllEmailTemplates } from "@/lib/email-templates";
import { EmailTemplatesManager } from "./_components/email-templates-manager";

export const metadata = { title: "Email Templates" };

export default async function EmailTemplatesPage() {
  const rows = await getAllEmailTemplates();

  const templates = EMAIL_TEMPLATE_TYPES.map((meta) => ({
    type: meta.type,
    label: meta.label,
    description: meta.description,
    defaultSubject: meta.defaultSubject,
    mergeTags: meta.mergeTags,
    subject: rows[meta.type]?.subject ?? null,
    body: rows[meta.type]?.body ?? null,
  }));

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Email Templates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Customize the subject and body of each customer-facing email. Leave
          a template untouched to keep Support Tool's default design.
        </p>
      </div>
      <EmailTemplatesManager initialTemplates={templates} />
    </div>
  );
}
