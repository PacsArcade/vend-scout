"use client";
import { useRouter } from "next/navigation";

export function CityFilter({ cities, current }: { cities: { slug: string; name: string }[]; current: string }) {
  const router = useRouter();
  return (
    <label className="runpick"><span>City</span>
      <select value={current} onChange={(e) => router.replace(e.target.value ? `/admin?city=${e.target.value}` : "/admin")}>
        <option value="">All cities</option>
        {cities.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
      </select>
    </label>
  );
}
