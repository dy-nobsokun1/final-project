// For an auction: the starting bid, the top bid, how many bids, and when it ends. Read only:
// bidding stays on the website for now.
import { StyleSheet, Text, View } from "react-native";

import { formatPrice } from "@/lib/format";
import { colors, radius } from "@/theme";
import type { AuctionInfo } from "@/types";

export function AuctionPanel({ auction, startingBid }: { auction: AuctionInfo; startingBid: number }) {
  const ends = new Date(auction.endsAt).toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Phnom_Penh",
  });
  const bids = auction.bidCount === 1 ? "1 bid" : `${auction.bidCount} bids`;

  return (
    <View style={styles.box}>
      <Text style={styles.heading}>{auction.ended ? "Auction ended" : "Auction"}</Text>
      <Text style={styles.line}>Starting bid: {formatPrice(startingBid)}</Text>
      <Text style={styles.line}>
        {auction.highestBid === null ? "No bids yet" : `Top bid: ${formatPrice(auction.highestBid)} (${bids})`}
      </Text>
      <Text style={styles.line}>{auction.ended ? "Ended" : "Ends"} {ends} (Phnom Penh time)</Text>
      {auction.ended ? null : <Text style={styles.note}>Place bids on the UniSwap website.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.inset, borderRadius: radius.card, padding: 16, gap: 6 },
  heading: { fontSize: 17, fontWeight: "800", color: colors.cardText },
  line: { fontSize: 15, color: colors.cardText },
  note: { fontSize: 13, color: colors.cardText, opacity: 0.7, marginTop: 4 },
});
