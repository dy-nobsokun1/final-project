// A wrapped row of pill buttons where one can be chosen (the Sell form's category, condition and type).
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius } from "@/theme";

interface Props<T extends string> {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T | null;
  onChange: (value: T) => void;
}

export function ChoiceChips<T extends string>({ label, options, value, onChange }: Props<T>) {
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => onChange(option.value)}
              style={[styles.chip, active && styles.active]}
            >
              <Text style={[styles.text, active && styles.activeText]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { color: colors.cardText, fontSize: 14, fontWeight: "600" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1.5, borderColor: colors.accent, backgroundColor: colors.inset, borderRadius: radius.pill,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  active: { backgroundColor: colors.dark, borderColor: colors.dark },
  text: { color: colors.cardText, fontWeight: "600", fontSize: 15 },
  activeText: { color: colors.inset },
});
