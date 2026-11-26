// Sell tab: post an item from the phone. Photos first (SellPhotos), then the fields (SellFields), then
// Publish, which opens the new item page. Signed out, it asks the student to sign in.
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Notice } from "@/components/Notice";
import { ScreenTitle } from "@/components/ScreenTitle";
import { SellFields } from "@/components/SellFields";
import { SellPhotos } from "@/components/SellPhotos";
import { SignInPrompt } from "@/components/SignInPrompt";
import { useSellForm } from "@/hooks/use-sell-form";
import { useSellPhotos } from "@/hooks/use-sell-photos";
import { useAuth } from "@/lib/auth";
import { colors, radius } from "@/theme";

export default function SellScreen() {
  const { user, loading } = useAuth();
  const photos = useSellPhotos();
  const form = useSellForm(photos);

  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <ScreenTitle text="Sell" />
      {loading ? null : !user ? (
        <SignInPrompt message="Sign in to sell, trade or give away your things to other AUPP students." />
      ) : (
        <KeyboardAvoidingView style={styles.page} behavior="padding">
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag">
            <View style={styles.card}>
              <SellPhotos photos={photos} />
              <SellFields form={form} />
              <Notice text={form.error} />
              <Button label="Publish" onPress={form.publish} busy={form.busy || photos.uploading} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { padding: 16, paddingBottom: 120 },
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: 18, gap: 16 },
});
