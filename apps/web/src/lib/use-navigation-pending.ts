import { useEffect, useState } from "react";

/**
 * Pending flag for an action that ends by navigating away. Next.js keeps visited
 * pages alive with their state, so without this a user who comes back (for
 * example signing in again after signing out) finds the button still spinning.
 * Hiding a kept-alive page runs effect cleanups, which resets the flag.
 */
export function useNavigationPending() {
  const [pending, setPending] = useState(false);
  useEffect(() => () => setPending(false), []);
  return [pending, setPending] as const;
}
