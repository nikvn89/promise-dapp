import { createClient } from "genlayer-js";

// Ensure you are pointing to the correct chain (localnet/simulator/studionet)
// For hackathon purposes, we use the default exported configurations.
import { studionet } from "genlayer-js/chains";

export const CONTRACT_ADDRESS = '0xe2939Af48086Ce08dba291113AcC172D6119f552';

export const getClient = (account?: string) => {
  // @ts-ignore
  const provider = typeof window !== 'undefined' ? window.ethereum : undefined;
  return createClient({
    chain: studionet,
    account: account as any,
    provider
  });
};
