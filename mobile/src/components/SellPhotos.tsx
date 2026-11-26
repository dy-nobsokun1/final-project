// The top of the Sell form: the picked photos (the first one says "Cover", X removes one), then
// "Take photo" and "Choose from library" while there is room for more.
import { Image } from "expo-image";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Notice } from "@/components/Notice";
import { MAX_PHOTOS, type useSellPhotos } from "@/hooks/use-sell-photos";
import { photoUrl } from "@/lib/format";
import { colors, radius } from "@/theme";

export function SellPhotos({ photos }: { photos: ReturnType<typeof useSellPhotos> }) {
  const room = photos.urls.length < MAX_PHOTOS;
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Photos ({photos.urls.length} of {MAX_PHOTOS}, the first is the cover)</Text>
      <View style={styles.row}>
        {photos.urls.map((url, index) => (
          <View key={url}>
            <Image source={photoUrl(url)} style={styles.thumb} contentFit="cover" />
            {index === 0 ? <Text style={styles.cover}>Cover</Text> : null}
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove photo ${index + 1}`}
              onPress={() => photos.remove(url)} style={styles.remove} hitSlop={8}>
              <Text style={styles.removeText}>✕</Text>
            </Pressable>
          </View>
        ))}
        {photos.uploading ? <ActivityIndicator color={colors.cardText} style={styles.thumb} /> : null}
      </View>
      {room ? (
        <View style={styles.row}>
          <PickButton label="Take photo" onPress={() => photos.add("camera")} disabled={photos.uploading} />
          <PickButton label="Choose from library" onPress={() => photos.add("library")} disabled={photos.uploading} />
        </View>
      ) : null}
      <Notice text={photos.error} />
    </View>
  );
}

function PickButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled}
      style={({ pressed }) => [styles.pick, (pressed || disabled) && styles.pressed]}>
      <Text style={styles.pickText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  label: { color: colors.cardText, fontSize: 14, fontWeight: "600" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  thumb: { width: 88, height: 88, borderRadius: radius.field, backgroundColor: colors.inset },
  cover: {
    position: "absolute", left: 4, bottom: 4, backgroundColor: colors.dark, color: colors.inset, fontSize: 11,
    fontWeight: "700", paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, overflow: "hidden",
  },
  remove: {
    position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.dark, alignItems: "center", justifyContent: "center",
  },
  removeText: { color: colors.inset, fontSize: 13, fontWeight: "800" },
  pick: { flex: 1, borderWidth: 1.5, borderColor: colors.cardText, borderRadius: radius.pill, paddingVertical: 11, alignItems: "center" },
  pressed: { opacity: 0.6 },
  pickText: { color: colors.cardText, fontWeight: "700", fontSize: 15 },
});
