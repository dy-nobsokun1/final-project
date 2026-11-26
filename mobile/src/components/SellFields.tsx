// The Sell form's fields under the photos: title, category, condition, type, the amount the type needs
// (price, cash top-up or budget) and the description. Labels copied from the website's form.
import { StyleSheet, Text } from "react-native";

import { ChoiceChips } from "@/components/ChoiceChips";
import { TextField } from "@/components/TextField";
import type { SellType, useSellForm } from "@/hooks/use-sell-form";
import { CATEGORIES, CONDITION_OPTIONS } from "@/lib/format";
import { colors } from "@/theme";

const TYPES: Array<{ value: SellType; label: string }> = [
  { value: "sale", label: "For sale" },
  { value: "giveaway", label: "Giveaway" },
  { value: "trade", label: "For trade" },
  { value: "buy_request", label: "Wanted" },
];

export function SellFields({ form }: { form: ReturnType<typeof useSellForm> }) {
  return (
    <>
      <TextField label="Title" value={form.title} onChangeText={form.setTitle} maxLength={120}
        placeholder="Calculus: Early Transcendentals, 9th ed." autoCorrect />
      <ChoiceChips label="Category" options={CATEGORIES} value={form.category} onChange={form.setCategory} />
      <ChoiceChips label="Condition" options={CONDITION_OPTIONS} value={form.condition} onChange={form.setCondition} />
      <ChoiceChips label="Listing type" options={TYPES} value={form.type} onChange={form.setType} />
      <Text style={styles.note}>Auctions: post them on the website.</Text>
      {form.type === "sale" ? (
        <TextField label="Price (USD)" value={form.price} onChangeText={form.setPrice} keyboardType="decimal-pad" />
      ) : null}
      {form.type === "trade" ? (
        <TextField label="Cash top-up you ask for (USD, optional)" value={form.cashTopup}
          onChangeText={form.setCashTopup} keyboardType="decimal-pad" />
      ) : null}
      {form.type === "buy_request" ? (
        <TextField label="Budget (USD, 0 for any price)" value={form.price} onChangeText={form.setPrice}
          keyboardType="decimal-pad" />
      ) : null}
      <TextField label="Description (optional)" value={form.description} onChangeText={form.setDescription}
        placeholder="Condition, defects, and what is included." multiline autoCorrect style={styles.description} />
    </>
  );
}

const styles = StyleSheet.create({
  note: { color: colors.cardText, opacity: 0.7, fontSize: 13, marginTop: -6 },
  description: { minHeight: 110, textAlignVertical: "top" },
});
