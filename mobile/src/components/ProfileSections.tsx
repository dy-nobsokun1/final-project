// Everything under the card on the Account tab: totals, My listings (any status, with a pill) and
// Recent purchases (hidden until the first one). Tapping a card opens the item.
import { ActivityIndicator, StyleSheet, Text } from "react-native";

import { ListingWrap } from "@/components/ListingWrap";
import { Notice } from "@/components/Notice";
import { ProfileTotals } from "@/components/ProfileTotals";
import { colors } from "@/theme";
import type { ListingWithSeller, Purchase, UserStats } from "@/types";

interface Props {
  stats: UserStats | null;
  listings: ListingWithSeller[];
  purchases: Purchase[];
  error: string | null;
}

export function ProfileSections({ stats, listings, purchases, error }: Props) {
  if (error && !stats) return <Notice text={error} />;
  if (!stats) return <ActivityIndicator color={colors.pageText} style={styles.spinner} />;
  return (
    <>
      <ProfileTotals stats={stats} />
      {listings.length > 0 ? (
        <ListingWrap title="My listings" listings={listings} showStatus />
      ) : (
        <Text style={styles.empty}>No listings yet. Tap Sell to post your first item.</Text>
      )}
      {purchases.length > 0 ? (
        <ListingWrap title="Recent purchases" listings={purchases.map((purchase) => purchase.listing)} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  spinner: { marginTop: 20 },
  empty: { color: colors.pageMuted, fontSize: 16, textAlign: "center" },
});
