// Account tab: the student's own profile. Their card with Sign out, then totals, My listings and
// Recent purchases (ProfileSections). Signed out, it asks them to sign in.
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AccountCard } from "@/components/AccountCard";
import { ProfileSections } from "@/components/ProfileSections";
import { ScreenTitle } from "@/components/ScreenTitle";
import { SignInPrompt } from "@/components/SignInPrompt";
import { useProfile } from "@/hooks/use-profile";
import { useAuth } from "@/lib/auth";
import { colors } from "@/theme";

export default function AccountScreen() {
  const { user, loading, signOut } = useAuth();
  const { stats, listings, purchases, error, refreshing, refresh } = useProfile();

  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <ScreenTitle text="Account" />
      {loading ? (
        <ActivityIndicator color={colors.pageText} style={styles.spinner} />
      ) : !user ? (
        <SignInPrompt message="Save items, chat with sellers and sell your own things." />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.pageText} />}
        >
          <AccountCard user={user} onSignOut={signOut} />
          <ProfileSections stats={stats} listings={listings} purchases={purchases} error={error} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  spinner: { marginTop: 40 },
  content: { padding: 16, gap: 20, paddingBottom: 40 },
});
