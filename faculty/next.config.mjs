/** @type {import('next').NextConfig} */
export default {
  // better-sqlite3 is a native addon; keep it out of the bundler's graph.
  serverExternalPackages: ["better-sqlite3"],
};
