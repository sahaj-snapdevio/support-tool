import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import { LocalDateTime } from "@/components/common/local-datetime";
import { ADMIN_ROLE } from "@/config/platform";
import { PendingUserActions } from "./pending-user-actions";

interface PendingUser {
  createdAt: Date;
  email: string;
  id: string;
  name: string;
  role: string;
}

export function PendingInvitations({ users }: { users: PendingUser[] }) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden mb-6">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-accent/50">
        <EnvelopeSimpleIcon className="size-4 text-muted-foreground" />
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Pending Invitations ({users.length})
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border/50">
            {users.map((u) => (
              <tr className="hover:bg-accent/30 transition-colors" key={u.id}>
                <td className="px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {u.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {u.email}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${
                      u.role === ADMIN_ROLE
                        ? "bg-primary/10 border-primary/20 text-foreground"
                        : "bg-muted/20 border-border text-muted-foreground"
                    }`}
                  >
                    {u.role === ADMIN_ROLE ? "Admin" : "Agent"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium bg-amber-50 border-amber-200 text-amber-700">
                    Invited
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  <LocalDateTime date={u.createdAt} mode="date" />
                </td>
                <td className="px-4 py-3">
                  <PendingUserActions
                    userEmail={u.email}
                    userId={u.id}
                    userName={u.name}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
