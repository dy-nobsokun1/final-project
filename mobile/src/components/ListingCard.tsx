// One item in a grid: cover photo, title, price and condition. A Wanted post has no photo, so it gets
// the dark card with its category icon and the rose WANTED tag, like the website's WantedCard.
// showStatus (the student's own listings) adds a pill such as "Sold" on the photo.
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { CategoryIcon } from "@/components/CategoryIcon";
import { canShowPhoto, conditionLabel, formatListingPrice, photoUrl, statusLabel } from "@/lib/format";
import { colors, radius } from "@/theme";
import type { ListingWithSeller } from "@/types";

interface Props {
  listing: ListingWithSeller;
  width: number;
  showStatus?: boolean;
}

export function ListingCard({ listing, width, showStatus }: Props) {
  const wanted = listing.listingType === "buy_request";
  const cover = listing.imageUrls.find(canShowPhoto);
  const textColor = wanted ? colors.pageText : colors.cardText;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${listing.title}, ${formatListingPrice(listing)}${showStatus ? `, ${statusLabel(listing.status)}` : ""}`}
      onPress={() => router.push(`/listings/${listing.id}`)}
      style={({ pressed }) => [styles.card, wanted && styles.wantedCard, { width }, pressed && styles.pressed]}
    >
      {wanted || !cover ? (
        <View style={[styles.cover, styles.iconCover]}>
          <CategoryIcon category={listing.category} size={44} color={wanted ? colors.pageMuted : colors.cardText} />
          {wanted ? <Text style={styles.wantedTag}>WANTED</Text> : null}
        </View>
      ) : (
        <Image source={photoUrl(cover)} style={styles.cover} contentFit="cover" transition={200} />
      )}
      {showStatus ? <Text style={styles.status}>{statusLabel(listing.status)}</Text> : null}
      <View style={styles.body}>
        <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>{listing.title}</Text>
        <Text style={[styles.price, { color: textColor }]}>{formatListingPrice(listing)}</Text>
        {wanted ? null : <Text style={styles.condition}>{conditionLabel(listing.condition)}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.card, overflow: "hidden" },
  wantedCard: { backgroundColor: colors.wantedCard, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.pageMuted },
  pressed: { opacity: 0.75 },
  cover: { width: "100%", aspectRatio: 1, backgroundColor: colors.inset },
  iconCover: { backgroundColor: "transparent", alignItems: "center", justifyContent: "center", gap: 10 },
  wantedTag: {
    backgroundColor: colors.wanted, color: colors.cardText, fontWeight: "800", fontSize: 12, letterSpacing: 1,
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, overflow: "hidden",
  },
  status: {
    position: "absolute", top: 8, left: 8, backgroundColor: colors.dark, color: colors.inset, fontWeight: "700",
    fontSize: 12, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, overflow: "hidden",
  },
  body: { padding: 10, gap: 4 },
  title: { fontSize: 15, fontWeight: "600", minHeight: 38 },
  price: { fontSize: 17, fontWeight: "800" },
  condition: { fontSize: 13, color: colors.cardText, opacity: 0.75 },
});
