import type { MachineType } from "./types";

// The machine type catalog the host sees. Footprint and power are defaults. Edit them here.
export interface TypeInfo { id: MachineType; label: string; sells: string; footprint: string; power: string }
export const TYPE_INFO: Record<MachineType, TypeInfo> = {
  snack: { id: "snack", label: "Snack machine", sells: "Chips, cookies, candy and bars in spiral rows.", footprint: "About 3 ft wide, 3 ft deep", power: "One standard outlet" },
  drinks: { id: "drinks", label: "Drinks machine", sells: "Water, juice, tea and soda, chilled.", footprint: "About 3 ft wide, 3 ft deep", power: "One standard outlet" },
  combo: { id: "combo", label: "Combo machine", sells: "Snacks on top and cold drinks below, in one cabinet.", footprint: "About 3.5 ft wide, 3 ft deep", power: "One standard outlet" },
  fresh: { id: "fresh", label: "Fresh and fridge", sells: "Sandwiches, fruit and salads in a glass fridge.", footprint: "About 3 ft wide, 3 ft deep", power: "One dedicated outlet" },
  coffee: { id: "coffee", label: "Coffee machine", sells: "Hot coffee, tea and cocoa made to order.", footprint: "About 2 ft wide, 2 ft deep", power: "One outlet and a water line" },
  cards: { id: "cards", label: "Trading cards", sells: "Pokémon and other trading card packs and boxes.", footprint: "About 2.5 ft wide, 2 ft deep", power: "One standard outlet" },
  art: { id: "art", label: "Art and stickers", sells: "Small prints, stickers and pins from local artists.", footprint: "About 2.5 ft wide, 2 ft deep", power: "One standard outlet" },
  lockers: { id: "lockers", label: "Pickup lockers", sells: "Orders from the shop, held for pickup any hour.", footprint: "About 4 ft wide, 2 ft deep", power: "One standard outlet" },
  claw: { id: "claw", label: "Claw and arcade", sells: "Prizes from a claw or a small arcade cabinet.", footprint: "About 3 ft wide, 3 ft deep", power: "One standard outlet" },
  other: { id: "other", label: "Something else", sells: "Tell us what you have in mind.", footprint: "To be agreed", power: "To be agreed" },
};
export const typeLabel = (t: MachineType, other?: string) => (t === "other" && other ? other : TYPE_INFO[t].label);
