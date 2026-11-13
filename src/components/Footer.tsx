import { connection } from "next/server";
import { ContactLine } from "./ContactLine";

export async function Footer() {
  await connection(); // read VEND_CONTACT_EMAIL at request time, not at build time
  return (
    <footer className="sitefoot">
      <span className="footbrand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/02-wordmark-plate-full.svg" alt="VendFrens" width={106} height={37} />
        <span>a Pac&apos;s Arcade project</span>
      </span>
      <ContactLine />
    </footer>
  );
}
