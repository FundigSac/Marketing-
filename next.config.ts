import type { NextConfig } from "next";

// Rutas del sistema anterior: llevan a la sección equivalente para no dejar enlaces rotos.
const toHome = ["/admin", "/agenda", "/campanas/:path*", "/metricas/:path*", "/notificaciones/:path*", "/eventos/:path*", "/ia/radar", "/ia/plan"];
const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/estudio", destination: "/ideas", permanent: true },
      { source: "/ia/ideas", destination: "/ideas", permanent: true },
      { source: "/ia/debate", destination: "/ideas", permanent: true },
      { source: "/produccion/:path*", destination: "/videos", permanent: true },
      { source: "/historial", destination: "/videos?tab=historial", permanent: true },
      { source: "/calendario/semana", destination: "/calendario", permanent: true },
      ...toHome.map((source) => ({ source, destination: "/", permanent: true })),
    ];
  },
};

export default nextConfig;
