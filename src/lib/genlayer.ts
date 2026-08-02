import { createClient } from "genlayer-js";

// Ensure you are pointing to the correct chain (localnet/simulator/studionet)
// For hackathon purposes, we use the default exported configurations.
import { studionet } from "genlayer-js/chains";

export const CONTRACT_ADDRESS = '0xA6d068aCF27c3138c1e01D13eab57e274929e2fb';

export const getClient = (account?: string) => {
  // @ts-ignore
  const provider = typeof window !== 'undefined' ? window.ethereum : undefined;
  return createClient({
    chain: studionet,
    account: account as any,
    provider
  });
};
