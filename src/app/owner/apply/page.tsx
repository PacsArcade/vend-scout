import { Nav } from "@/components/Nav";
import { OwnerApply } from "@/components/OwnerApply";

export const dynamic = "force-dynamic";

export default function OwnerApplyPage() {
  return (
    <>
      <Nav on="" />
      <main className="page narrow">
        <h1>Host a machine</h1>
        <p className="muted">Own or run a place where people wait? Apply to host a vending machine. Sign in with your nostr key, tell us about the place, and say where your rent should go in sats. An operator reads every application.</p>
        <OwnerApply />
      </main>
    </>
  );
}
