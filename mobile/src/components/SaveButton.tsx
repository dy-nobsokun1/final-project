// The heart on the item page. Signed out, it opens Log in. Signed in, it checks if this item is saved
// (GET /api/users/me/saved/ids) and saves or unsaves it (POST / DELETE /api/listings/:id/save).
import { router, useFocusEffect } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet } from "react-native";

import { apiFetch, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors } from "@/theme";

export function SaveButton({ listingId }: { listingId: string }) {
  const { token } = useAuth();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!token) return setSaved(false);
      apiFetch<{ listingIds: string[] }>("/api/users/me/saved/ids", { token })
        .then((data) => setSaved(data.listingIds.includes(listingId)))
        .catch(() => setSaved(false)); // like the website: a failed lookup only empties the heart
    }, [token, listingId]),
  );

  async function toggle() {
    if (!token) return router.push("/login");
    setBusy(true);
    try {
      await apiFetch(`/api/listings/${listingId}/save`, { method: saved ? "DELETE" : "POST", token });
      setSaved(!saved);
    } catch (err) {
      Alert.alert("Could not save", errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={saved ? "Remove from saved" : "Save this item"}
      accessibilityState={{ selected: saved }}
      onPress={toggle}
      disabled={busy}
      hitSlop={10}
      style={styles.button}
    >
      <SymbolView name={saved ? "heart.fill" : "heart"} size={26} tintColor={saved ? colors.wanted : colors.cardText} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.inset, alignItems: "center", justifyContent: "center" },
});
