// "Message seller" on the item page, like the website: only for an item that is not sold or traded,
// and never on your own item. Signed out, it opens Log in, which comes back here afterwards.
import { router } from "expo-router";

import { Button } from "@/components/Button";
import { useAuth } from "@/lib/auth";
import type { ListingWithSeller } from "@/types";

export function MessageSellerButton({ listing }: { listing: ListingWithSeller }) {
  const { user } = useAuth();
  if (listing.status === "sold" || listing.status === "traded") return null;
  if (user && user.id === listing.sellerId) return null;

  const label = listing.listingType === "buy_request" ? "I have this: message them" : "Message seller";
  function open() {
    if (!user) router.push("/login");
    else router.push(`/chat/${listing.id}/${listing.sellerId}`);
  }
  return <Button label={label} onPress={open} />;
}
