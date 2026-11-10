import { createFileRoute, redirect } from "@tanstack/react-router";
import { ensureDefaultSession } from "@/lib/quick-access";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    ensureDefaultSession();
    throw redirect({ to: "/painel" });
  },
  head: () => ({
    meta: [
      { title: "Caroldo | Painel de Gestão" },
      { name: "description", content: "Sistema integrado de gestão da Caroldo." },
      { property: "og:title", content: "Caroldo | Portal de Gestão" },
      { property: "og:description", content: "Sistema integrado de gestão da Caroldo." },
      { property: "og:type", content: "website" },
      { name: "theme-color", content: "#08090c" },
    ],
  }),
});
