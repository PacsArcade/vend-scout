import type { NextConfig } from "next";
// data-osm/ is read with fs at runtime, so tell the build to ship it with every route.
const config: NextConfig = { outputFileTracingIncludes: { "/**/*": ["./data-osm/**/*"] } };
export default config;
