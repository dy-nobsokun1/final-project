// A row of category buttons under the search box. Tapping the chosen one again shows all categories.
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { CATEGORIES } from "@/lib/format";
import { colors, radius } from "@/theme";
import type { ListingCategory } from "@/types";

interface Props {
  selected: ListingCategory | null;
  onSelect: (category: ListingCategory | null) => void;
}

export function CategoryChips({ selected, onSelect }: Props) {
  const chips = [{ value: null, label: "All" }, ...CATEGORIES];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {chips.map((chip) => {
        const active = chip.value === selected;
        return (
          <Pressable
            key={chip.label}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(active ? null : chip.value)}
            style={[styles.chip, active && styles.active]}
          >
            <Text style={[styles.label, active && styles.activeLabel]}>{chip.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 4 },
  chip: { borderWidth: 1.5, borderColor: colors.pageMuted, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7 },
  active: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { color: colors.pageText, fontWeight: "600", fontSize: 14 },
  activeLabel: { color: colors.cardText },
});
