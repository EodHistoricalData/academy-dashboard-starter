import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // AGENTS.md is ours: stop `next dev` from rewriting it on first run.
  agentRules: false,
};

export default nextConfig;
