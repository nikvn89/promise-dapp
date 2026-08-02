import { createClient } from "genlayer-js";

// Ensure you are pointing to the correct chain (localnet/simulator/studionet)
// For hackathon purposes, we use the default exported configurations.
import { studionet } from "genlayer-js/chains";

export const CONTRACT_ADDRESS = '0x3F35265cAeB7A83831910D303f3F2937430CB6Df';

export const getClient = (account?: string) => {
  // @ts-ignore
  const provider = typeof window !== 'undefined' ? window.ethereum : undefined;
  return createClient({
    chain: studionet,
    account: account as any,
    provider
  });
};
