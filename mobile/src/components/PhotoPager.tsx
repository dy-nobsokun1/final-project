// The item page's photos: swipe left and right, one photo per screen width, with dots underneath.
// No photos the app can load (or a Wanted post): the category icon instead.
import { Image } from "expo-image";
import { useState } from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";

import { CategoryIcon } from "@/components/CategoryIcon";
import { canShowPhoto, photoUrl } from "@/lib/format";
import { colors } from "@/theme";
import type { ListingCategory } from "@/types";

export function PhotoPager({ urls: allUrls, category }: { urls: string[]; category: ListingCategory }) {
  const urls = allUrls.filter(canShowPhoto);
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const height = width * 0.85;

  if (urls.length === 0) {
    return (
      <View style={[styles.empty, { height: height * 0.6 }]}>
        <CategoryIcon category={category} size={72} color={colors.pageMuted} />
      </View>
    );
  }

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => setPage(Math.round(event.nativeEvent.contentOffset.x / width))}
      >
        {urls.map((url, index) => (
          <Image key={url} source={photoUrl(url)} style={{ width, height }} contentFit="cover"
            accessibilityLabel={`Photo ${index + 1} of ${urls.length}`} />
        ))}
      </ScrollView>
      {urls.length > 1 ? (
        <View style={styles.dots}>
          {urls.map((url, index) => <View key={url} style={[styles.dot, index === page && styles.dotOn]} />)}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { backgroundColor: colors.wantedCard, alignItems: "center", justifyContent: "center" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, paddingTop: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.line },
  dotOn: { backgroundColor: colors.pageText },
});
