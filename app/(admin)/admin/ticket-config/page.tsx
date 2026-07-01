import { getTicketStatuses, getTicketCategories } from "@/lib/ticket-config";
import { StatusesManager } from "./_components/statuses-manager";
import { CategoriesManager } from "./_components/categories-manager";

export const metadata = { title: "Ticket Config" };

export default async function TicketConfigPage() {
  const [statuses, categories] = await Promise.all([
    getTicketStatuses(),
    getTicketCategories(),
  ]);

  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      <StatusesManager initialStatuses={statuses} />
      <CategoriesManager initialCategories={categories} />
    </div>
  );
}
