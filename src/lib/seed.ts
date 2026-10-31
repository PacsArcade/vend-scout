import type { Machine, Note, PickupOrder, Prospect, Slot, VoteOption } from "./types";

// All names and numbers are made up.
export const SEED_PROSPECTS: Prospect[] = [
  { id: "suds-24", name: "Suds 24 Laundromat", area: "Pilsen", lat: 41.8565, lon: -87.6600, category: "laundry", openingHours: "24/7", nearestMachineM: 650, why: "Open 24 hours. Long waits (45 min a load). No machine inside. Nearest snacks 650 m, closed after 10 PM.", stage: "Pitched", source: "demo", contact: "Maria (from the shop sign)" },
  { id: "iron-temple", name: "Iron Temple Gym", area: "Little Village", lat: 41.8440, lon: -87.7170, category: "gym", openingHours: "Mo-Fr 05:00-23:00; Sa-Su 07:00-21:00", nearestMachineM: 480, why: "Members wait between sets and classes. Only a water fountain. Asks for protein options.", stage: "Visited", source: "demo" },
  { id: "halsted-auto", name: "Halsted Auto Care", area: "Bridgeport", lat: 41.8420, lon: -87.6460, category: "car_repair", openingHours: "Mo-Sa 07:00-19:00", nearestMachineM: 700, why: "Customers wait 1 to 3 hours. A coffee pot, no food.", stage: "Found", source: "demo" },
  { id: "sparkle-wash", name: "Sparkle Car Wash", area: "Belmont Cragin", lat: 41.9390, lon: -87.7680, category: "car_wash", openingHours: "Mo-Su 06:00-24:00", nearestMachineM: 350, why: "Self-serve bays open to midnight. Old machine taken out last year (a review says so).", stage: "Found", source: "demo" },
  { id: "bubble-brothers", name: "Bubble Brothers Wash and Fold", area: "Rogers Park", lat: 42.0080, lon: -87.6680, category: "laundry", openingHours: "Mo-Su 07:00-22:00", nearestMachineM: 220, why: "Busy evenings, a machine across the street.", stage: "Found", source: "demo" },
  { id: "pulse-fitness", name: "Pulse Fitness Lincoln Park", area: "Lincoln Park", lat: 41.9230, lon: -87.6490, category: "gym", openingHours: "24/7", nearestMachineM: 150, why: "Open all night but a vending machine sits in the lobby next door.", stage: "Found", source: "demo" },
  { id: "south-shore-suds", name: "South Shore Suds", area: "South Shore", lat: 41.7620, lon: -87.5810, category: "laundry", openingHours: "Mo-Su 06:00-23:00", nearestMachineM: 900, why: "Nothing open near here late. Long waits on weekends.", stage: "Found", source: "demo" },
  { id: "lakeview-lube", name: "Lakeview Quick Lube", area: "Lakeview", lat: 41.9440, lon: -87.6530, category: "car_repair", nearestMachineM: 300, why: "Short waits. Hours not known.", stage: "Found", source: "demo" },
];

export const SEED_NOTES: Record<string, Note[]> = {
  "suds-24": [
    { date: "Oct 28", text: "Walked in at 9 PM, 11 people waiting, two kids asking for snacks." },
    { date: "Oct 30", text: "Left the pitch sheet with the night attendant. Maria back Monday." },
    { date: "Nov 2", text: "Reminder: call Maria, offer 10% and a free first month." },
  ],
};

const raw: [string, string, number, boolean?, boolean?][] = [
  ["A1", "Hot chips", 0.1], ["A2", "Doritos", 0.6], ["A3", "Pretzels", 0.8], ["A4", "Trail mix", 0.5], ["A5", "Gummies", 0.7], ["A6", "Cookies", 0.4],
  ["B1", "Water", 0.7], ["B2", "Juice", 0.5], ["B3", "Energy", 0.3], ["B4", "Iced tea", 0.9], ["B5", "Soda", 0.6], ["B6", "Seltzer", 0.8],
  ["C1", "Protein bar", 0.5], ["C2", "Granola", 0.6], ["C3", "Jerky", 0.2], ["C4", "Nuts", 0.7], ["C5", "Candy", 0.9], ["C6", "Gum", 1],
  ["D1", "DW stickers", 0.6, true], ["D2", "Mini print", 0.3, true], ["D3", "Pin", 0.8, true], ["D4", "Pods", 0.5],
  ["P1", "Pickup", 1, false, true], ["P2", "Pickup", 1, false, true],
];
const slots: Slot[] = raw.map(([code, name, level, dw, pickup]) => ({ code, name, level, dw, pickup, priceSats: dw ? 5000 : 3000 }));

export const SEED_MACHINES: Machine[] = [
  {
    id: "m01", name: "Machine 01 · Suds 24", host: "Suds 24 Laundromat", placed: "Nov 9", nextRestock: "Thu 7 AM", slots,
    today: 64, week: 412, btcShare: 18, hostSharePct: 10, hostOwed: 41,
    sales: [
      { item: "Hot chips", sold: 41, left: 3 },
      { item: "Water", sold: 38, left: 12 },
      { item: "DW sticker pack", sold: 9, left: 6 },
      { item: "Whisper mini print", sold: 4, left: 2 },
    ],
  },
];

export const SEED_VOTES: Record<string, VoteOption[]> = {
  m01: [
    { id: "cheetos", name: "Hot Cheetos", votes: 23, sats: 0 },
    { id: "protein", name: "Protein bars", votes: 15, sats: 0 },
    { id: "juice", name: "Juice boxes for kids", votes: 11, sats: 0 },
    { id: "pods", name: "Laundry pods", votes: 8, sats: 0 },
    { id: "dw", name: "DW sticker pack", votes: 5, sats: 0 },
  ],
};

export const SEED_ORDERS: PickupOrder[] = [
  { code: "4219", item: "Whisper mini print · \"The Hatter's Hour\"", paid: "Paid · 21,000 sats", machine: "m01", slot: "P2", heldDays: 3 },
];
