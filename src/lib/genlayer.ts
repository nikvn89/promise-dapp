import { createClient } from "genlayer-js";

// Ensure you are pointing to the correct chain (localnet/simulator/studionet)
// For hackathon purposes, we use the default exported configurations.
import { studionet } from "genlayer-js/chains";

export const CONTRACT_ADDRESS = '0xFc49da2B55f67664cf391Ef1729d164Ab41CEB53';

export const getClient = (account?: string) => {
  // @ts-ignore
  const provider = typeof window !== 'undefined' ? window.ethereum : undefined;
  return createClient({
    chain: studionet,
    account: account as any,
    provider
  });
};
