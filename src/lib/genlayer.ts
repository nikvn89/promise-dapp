import { createClient } from "genlayer-js";

// Ensure you are pointing to the correct chain (localnet/simulator/studionet)
// For hackathon purposes, we use the default exported configurations.
import { studionet } from "genlayer-js/chains";

export const CONTRACT_ADDRESS = "0x0726F885f4bb75BAb9d7b8b8cF3941525F6FA9CA";

export const client = createClient({
  chain: studionet,
});
