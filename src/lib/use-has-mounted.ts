import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

/** True only after client hydration — avoids the setState-in-effect pattern for this. */
export function useHasMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
