import { AppearanceSettingsForm } from "./_components/appearance-settings-form";

export const metadata = { title: "Appearance" };

export default function AppearancePage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="bg-card rounded-xl border border-border shadow-soft p-6">
        <AppearanceSettingsForm />
      </div>
    </div>
  );
}
