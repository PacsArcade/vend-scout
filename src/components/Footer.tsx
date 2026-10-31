import { connection } from "next/server";
import { ContactLine } from "./ContactLine";

export async function Footer() {
  await connection(); // read VEND_CONTACT_EMAIL at request time, not at build time
  return (
    <footer className="sitefoot">
      <span>frens.earth · Machines, a Pac&apos;s Arcade project</span>
      <ContactLine />
    </footer>
  );
}
