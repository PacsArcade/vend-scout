import { Nav } from "@/components/Nav";
import { OperatorGate } from "@/components/OperatorGate";
import { operatorsConfigured } from "@/lib/operator";

export const dynamic = "force-dynamic";

export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <Nav on="" />
      <main className="page narrow"><h1>Operator sign-in</h1><OperatorGate configured={operatorsConfigured()} next={next ?? "/admin"} /></main>
    </>
  );
}
