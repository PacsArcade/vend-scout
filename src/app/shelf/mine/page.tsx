import { Nav } from "@/components/Nav";
import { MyListings } from "@/components/MyListings";

export default function Mine() {
  return (
    <>
      <Nav on="shelf" />
      <main className="page narrow">
        <h1>My listings</h1>
        <div className="glass card"><MyListings /></div>
      </main>
    </>
  );
}
