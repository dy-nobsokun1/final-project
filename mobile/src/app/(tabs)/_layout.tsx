// The tabs at the bottom of the phone: Browse, Sell, Inbox, Saved and Account (iOS draws the tab bar itself).
// The Inbox tab shows how many messages are unread (use-unread-count.ts).
import { NativeTabs } from "expo-router/native-tabs";

import { useUnreadCount } from "@/hooks/use-unread-count";
import { colors } from "@/theme";

export default function TabsLayout() {
  const unread = useUnreadCount();

  return (
    <NativeTabs tintColor={colors.primary}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Browse</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="square.grid.2x2" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="sell">
        <NativeTabs.Trigger.Label>Sell</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="plus.circle" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="inbox">
        <NativeTabs.Trigger.Label>Inbox</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="bubble.left.and.bubble.right" />
        {unread > 0 ? <NativeTabs.Trigger.Badge>{String(unread)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="saved">
        <NativeTabs.Trigger.Label>Saved</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="heart" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
