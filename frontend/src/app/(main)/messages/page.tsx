import { ConversationList } from "@/components/chat/ConversationList";
import { Card } from "@/components/ui/card";
import { getConversations, getUserById, requireUser } from "@/lib/api";
import type { User } from "@/types";

export const metadata = { title: "Messages | UniSwap" };

export default async function MessagesPage() {
  await requireUser();
  const conversations = await getConversations();

  // Resolved server-side so the client component stays free of lookups.
  const people = await Promise.all(
    conversations.map((conversation) => getUserById(conversation.partnerId)),
  );
  const partners = conversations.reduce<Record<string, User>>((acc, conversation, index) => {
    const partner = people[index];
    if (partner) acc[conversation.id] = partner;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-heading text-3xl tracking-tight">Messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Arrange a time and place to meet on campus.
        </p>
      </header>

      <Card className="overflow-hidden">
        <ConversationList conversations={conversations} partners={partners} />
      </Card>
    </div>
  );
}
