import { useEffect, useState } from "react";
import { connectivity, watchConnectivity, type Connectivity } from "./connectivity";

/**
 * The connection state, for a component that needs to render differently
 * without one.
 *
 * The state itself lives outside React — in lib/connectivity — because the
 * thing that learns about it first is an axios interceptor, which is not a
 * component and has no hooks. This only subscribes.
 */
export function useConnectivity(): Connectivity {
  const [state, setState] = useState<Connectivity>(connectivity);

  useEffect(() => {
    /*
     * Read once on mount as well as subscribing. The line can drop between
     * the initial useState and this effect running, and a component that
     * only subscribes would sit on a stale value until the NEXT change —
     * which, if the line stays down, never comes.
     */
    setState(connectivity());

    return watchConnectivity(setState);
  }, []);

  return state;
}

export function useIsOffline(): boolean {
  return useConnectivity() === "offline";
}
