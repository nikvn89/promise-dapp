import { createClient } from 'genlayer-js';
import { localnet } from 'genlayer-js/chains';

export const CONTRACT_ADDRESS = '0xbcf9EE06A7Cb5bb74Da57b71F7dBfe4081BA09e3';

const studioChain = {
  ...localnet,
  rpcUrls: {
    default: { http: ['https://studio.genlayer.com/api'] },
  },
};

export const getClient = (account?: string) => {
  if (account) {
    return createClient({
      chain: studioChain,
      account: account as `0x${string}`,
    });
  }
  return createClient({ chain: studioChain });
};
