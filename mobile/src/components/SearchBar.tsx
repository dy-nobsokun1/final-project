// The search box on Browse. It searches when the student presses Search on the keyboard (not on
// every letter), so the API gets one request per search. Clearing the box shows everything again.
import { useState } from "react";
import { StyleSheet, TextInput } from "react-native";

import { colors, radius } from "@/theme";

export function SearchBar({ onSearch }: { onSearch: (words: string) => void }) {
  const [text, setText] = useState("");

  function change(next: string) {
    setText(next);
    if (next === "") onSearch(""); // the clear (x) button empties the box: show all items again
  }

  return (
    <TextInput
      style={styles.input}
      value={text}
      onChangeText={change}
      onSubmitEditing={() => onSearch(text.trim())}
      placeholder="Search textbooks, laptops, bikes..."
      placeholderTextColor="#4f6b5f"
      returnKeyType="search"
      clearButtonMode="while-editing"
      autoCapitalize="none"
      autoCorrect={false}
      accessibilityLabel="Search UniSwap"
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.inset, color: colors.cardText, borderRadius: radius.pill,
    paddingHorizontal: 18, paddingVertical: 12, fontSize: 16,
  },
});
