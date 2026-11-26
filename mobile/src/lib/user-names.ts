// Chat partners' names for the Inbox and the thread header (GET /api/users/:id, public, no email).
// Kept in memory per id, so each name is asked for only once while the app runs.
import { apiFetch } from "@/lib/api";
import type { User } from "@/types";

const names = new Map<string, Promise<string>>();

export function getUserName(id: string): Promise<string> {
  let name = names.get(id);
  if (!name) {
    name = apiFetch<{ user: User }>(`/api/users/${id}`)
      .then((data) => data.user.name)
      .catch(() => {
        names.delete(id); // try again next time
        return "UniSwap student";
      });
    names.set(id, name);
  }
  return name;
}
