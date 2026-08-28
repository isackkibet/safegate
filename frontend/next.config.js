/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /* We compile packages in workspace root */
  transpilePackages: ["@safegate/shared-types"],
};

export default nextConfig;
