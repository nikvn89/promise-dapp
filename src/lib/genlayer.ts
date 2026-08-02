import { createClient } from "genlayer-js";

// Ensure you are pointing to the correct chain (localnet/simulator/studionet)
// For hackathon purposes, we use the default exported configurations.
import { studionet } from "genlayer-js/chains";

export const CONTRACT_ADDRESS = '0xFc49da2B55f67664cf391Ef1729d164Ab41CEB53';

export const getClient = (account?: string) => createClient({
  chain: studionet,
  provider: typeof window !== 'undefined' ? (window as any).ethereum : undefined,
  account: account as any
});
