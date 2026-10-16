import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False during server render and hydration, true once React is interactive. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
