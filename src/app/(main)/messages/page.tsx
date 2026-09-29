import { ConversationList } from "@/components/chat/ConversationList";
import { Card } from "@/components/ui/card";
import { getConversationPartner, getConversations } from "@/lib/api";
import type { User } from "@/types";

export const metadata = { title: "Messages | UniSwap" };

export default async function MessagesPage() {
  const conversations = await getConversations();

  // Resolved server-side so the client component stays free of lookups.
  const partners = conversations.reduce<Record<string, User>>((acc, conversation) => {
    const partner = getConversationPartner(conversation);
    if (partner) acc[conversation.id] = partner;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Arrange a time and place to meet on campus.
        </p>
      </header>

      <Card className="overflow-hidden">
        <ConversationList conversations={conversations} partners={partners} />
      </Card>
    </div>
  );
}

