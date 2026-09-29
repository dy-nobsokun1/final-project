import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { MessageComposer } from "@/components/chat/MessageComposer";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { VerifiedBadge } from "@/components/profile/VerifiedBadge";
import { getConversations, getMessages, getConversationPartner } from "@/lib/api";
import { CURRENT_USER_ID } from "@/lib/mock/data";

/** A single message thread. */
export default async function MessageThreadPage({
  params,
}: PageProps<"/messages/[id]">) {
  const { id } = await params;
  const conversations = await getConversations();
  const conversation = conversations.find((item) => item.id === id);

  if (!conversation) notFound();

  const [messages, partner] = await Promise.all([
    getMessages(conversation.id),
    Promise.resolve(getConversationPartner(conversation)),
  ]);

  return (
    <div className="light-surface flex h-full flex-col gap-4 rounded-xl bg-card p-4">
      <Link
        href="/messages"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        All conversations
      </Link>

      {partner ? (
        <header className="flex items-center gap-3">
          <UserAvatar name={partner.name} src={partner.avatarUrl} />
          <div className="flex items-center gap-1 font-medium">
            {partner.name}
            <VerifiedBadge isVerified={partner.isVerified} />
          </div>
        </header>
      ) : null}

      <ul className="flex flex-1 flex-col gap-2">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isOwn={message.senderId === CURRENT_USER_ID}
          />
        ))}
      </ul>

      <MessageComposer />
    </div>
  );
}

