import type { NextConfig } from "next";

/**
 * HLS se servira staticki iz public/media/hls.
 *
 * Content-Type Next vec postavlja tacno sam (`application/vnd.apple.mpegurl`
 * za .m3u8, `video/mp2t` za .ts), ali ga ovde i eksplicitno zakucavamo — u
 * Task 0.4 iste headere treba preslikati na CDN, pa je korisno da stoje na
 * jednom vidljivom mestu, a i neki static hostovi serviraju .m3u8 kao text/plain.
 *
 * CORS je potreban jer plejer segmente povlaci fetch-om; bez ovoga bi svaka
 * upotreba sa drugog originа (CDN, embed) pukla.
 */
const CORS_HEADERS = [
  { key: "Access-Control-Allow-Origin", value: "*" },
  { key: "Access-Control-Allow-Methods", value: "GET, HEAD, OPTIONS" },
  { key: "Access-Control-Allow-Headers", value: "Range, Content-Type" },
  // Bez ovoga plejer ne vidi zaglavlja koja su mu potrebna za seek.
  {
    key: "Access-Control-Expose-Headers",
    value: "Content-Length, Content-Range, Accept-Ranges",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Playliste — ne smeju da se kesiraju agresivno dok se media menja.
        source: "/media/:path*.m3u8",
        headers: [
          ...CORS_HEADERS,
          { key: "Content-Type", value: "application/vnd.apple.mpegurl" },
          { key: "Cache-Control", value: "public, max-age=60" },
        ],
      },
      {
        // Segmenti su nepromenljivi — ime fajla se menja kad se sadrzaj menja.
        source: "/media/:path*.ts",
        headers: [
          ...CORS_HEADERS,
          { key: "Content-Type", value: "video/mp2t" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // Zastita: sve ostalo pod /media (npr. .vtt, .jpg) bar dobije CORS.
        source: "/media/:path*",
        headers: CORS_HEADERS,
      },
    ];
  },
};

export default nextConfig;
