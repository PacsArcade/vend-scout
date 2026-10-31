// StockFeed: where camera or shelf-sensor counts would come in. v0 has a stub that reports nothing.
// No vendor calls here. TODO: pick the sensor or camera vendor, then write one adapter that returns SlotReading[].
export interface SlotReading { slot: string; count: number; capacity?: number; at: string; source: "camera" | "sensor" }
export interface StockFeed {
  name: string;
  readings(machineId: string): Promise<SlotReading[]>;
}
export const stubFeed: StockFeed = { name: "stub (no vendor connected)", async readings() { return []; } };
export const feed: StockFeed = stubFeed;
