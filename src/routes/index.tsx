import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "./auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Caroldo | Acesso ao sistema de gestão" },
      { name: "description", content: "Sistema integrado de gestão da Caroldo. Acesso corporativo seguro." },
      { property: "og:title", content: "Caroldo | Portal de Gestão" },
      { property: "og:description", content: "Sistema integrado de gestão da Caroldo." },
      { property: "og:type", content: "website" },
      { name: "theme-color", content: "#08090c" },
    ],
  }),
  component: AuthPage,
});
