// The root of the app: sign-in state for every screen, and a stack of screens on top of the tabs.
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AuthProvider } from "@/lib/auth";
import { colors } from "@/theme";

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.page },
          headerTintColor: colors.pageText,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.page },
          headerBackButtonDisplayMode: "minimal",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "Browse" }} />
        <Stack.Screen name="listings/[id]" options={{ title: "Item" }} />
        <Stack.Screen name="chat/[listingId]/[userId]" options={{ title: "Chat" }} />
        <Stack.Screen name="login" options={{ title: "Log in" }} />
        <Stack.Screen name="register" options={{ title: "Sign up" }} />
        <Stack.Screen name="verify" options={{ title: "Enter your code" }} />
      </Stack>
    </AuthProvider>
  );
}
