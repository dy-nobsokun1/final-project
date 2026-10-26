import { Sparkles } from "lucide-react";
import { AssistantChat } from "@/components/marketplace/AssistantChat";
import { EmptyState } from "@/components/ui/empty-state";
import { isAssistantEnabled, requireUser } from "@/lib/api";

export const metadata = { title: "Ask UniSwap | UniSwap" };

/** Ask UniSwap, the shopping assistant. Signed-in students only: the API needs a login for it. */
export default async function AssistantPage() {
  const user = await requireUser();

  if (!(await isAssistantEnabled())) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Ask UniSwap is switched off"
        description="The shopping assistant is not set up on this server yet. You can still search the listings."
        action={{ href: "/", label: "Browse listings" }}
      />
    );
  }
  return <AssistantChat userId={user.id} />;
}
