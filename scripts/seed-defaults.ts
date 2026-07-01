import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { ticketStatuses, ticketCategories } from "@/db/schema";

const defaultStatuses = [
  {
    id: createId(),
    slug: "open",
    label: "Open",
    color: "blue",
    sortOrder: 0,
    isDefault: true,
    isClosedState: false,
  },
  {
    id: createId(),
    slug: "in_progress",
    label: "In Progress",
    color: "amber",
    sortOrder: 1,
    isDefault: false,
    isClosedState: false,
  },
  {
    id: createId(),
    slug: "closed",
    label: "Closed",
    color: "slate",
    sortOrder: 2,
    isDefault: false,
    isClosedState: true,
  },
];

const defaultCategories = [
  {
    id: createId(),
    slug: "bug",
    label: "Bug",
    color: "red",
    sortOrder: 0,
  },
  {
    id: createId(),
    slug: "issue",
    label: "Issue",
    color: "orange",
    sortOrder: 1,
  },
  {
    id: createId(),
    slug: "feature_request",
    label: "Feature Request",
    color: "purple",
    sortOrder: 2,
  },
  {
    id: createId(),
    slug: "billing",
    label: "Billing",
    color: "green",
    sortOrder: 3,
  },
  {
    id: createId(),
    slug: "general_query",
    label: "General Query",
    color: "slate",
    sortOrder: 4,
  },
];

async function seed() {
  console.log("Seeding ticket statuses…");
  await db.insert(ticketStatuses).values(defaultStatuses).onConflictDoNothing();
  console.log(`  ✓ ${defaultStatuses.length} statuses (skipped if already exist)`);

  console.log("Seeding ticket categories…");
  await db.insert(ticketCategories).values(defaultCategories).onConflictDoNothing();
  console.log(`  ✓ ${defaultCategories.length} categories (skipped if already exist)`);

  console.log("Done.");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
