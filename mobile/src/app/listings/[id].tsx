// The item page (GET /api/listings/:id): photos, status and type, big price, the heart, auction
// details, facts, description and the seller. Works signed out; the heart asks to sign in.
// No heart on your own item: the API refuses to save it, and the website hides it too.
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { AuctionPanel } from "@/components/AuctionPanel";
import { ListingFacts } from "@/components/ListingFacts";
import { ListingHeading } from "@/components/ListingHeading";
import { MessageSellerButton } from "@/components/MessageSellerButton";
import { Notice } from "@/components/Notice";
import { PhotoPager } from "@/components/PhotoPager";
import { SaveButton } from "@/components/SaveButton";
import { SellerCard } from "@/components/SellerCard";
import { apiFetch, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors } from "@/theme";
import type { ListingWithSeller } from "@/types";

export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [listing, setListing] = useState<ListingWithSeller | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ listing: ListingWithSeller }>(`/api/listings/${id}`)
      .then((data) => setListing(data.listing))
      .catch((err) => setError(errorMessage(err))); // e.g. 404 "Listing not found."
  }, [id]);

  if (error) return <View style={styles.padded}><Notice text={error} /></View>;
  if (!listing) return <ActivityIndicator color={colors.pageText} style={styles.padded} />;
  const wanted = listing.listingType === "buy_request";
  const mine = user?.id === listing.sellerId;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <PhotoPager urls={wanted ? [] : listing.imageUrls} category={listing.category} />
      <View style={styles.body}>
        <View style={styles.headingRow}>
          <View style={styles.heading}><ListingHeading listing={listing} /></View>
          {mine ? null : <SaveButton listingId={listing.id} />}
        </View>
        {listing.auction ? <AuctionPanel auction={listing.auction} startingBid={listing.price} /> : null}
        <ListingFacts listing={listing} />
        {listing.description ? <Text style={styles.description}>{listing.description}</Text> : null}
        <SellerCard seller={listing.seller} wanted={wanted} />
        <MessageSellerButton listing={listing} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { paddingBottom: 40 },
  padded: { padding: 20 },
  body: { padding: 16, gap: 16 },
  headingRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  heading: { flex: 1 },
  description: { fontSize: 16, lineHeight: 24, color: colors.pageText },
});
