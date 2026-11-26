// True while this screen is the one on top (not covered by another screen or another tab).
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

export function useScreenFocused(): boolean {
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return focused;
}
