// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "fudly.sk",
          },
        ],
        destination: "https://www.fudly.sk/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;