import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardCheck, FileText, ShieldCheck, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Portal do Supervisor — Controle de presença e cobertura" },
      { name: "description", content: "Presença, cobertura de faltas, conferência de ponto em PDF e descontos de faturamento para serviços de limpeza." },
      { property: "og:title", content: "Portal do Supervisor" },
      { property: "og:description", content: "Presença, coberturas, ponto e descontos em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  const items = [
    { icon: ClipboardCheck, t: "Conferência diária", d: "Registre presença, faltas e justificativas em poucos cliques." },
    { icon: ShieldCheck, t: "Coberturas", d: "Diaristas e remanejamentos com bloqueio de conflitos de horário." },
    { icon: FileText, t: "Ponto em PDF", d: "Envio, leitura de texto e fila de divergências para revisão." },
    { icon: Calculator, t: "Descontos", d: "Horas descobertas, custo de coberturas e fechamento do período." },
  ];
  return (
    <div className="min-h-screen bg-sidebar text-sidebar-foreground">
      <div className="mx-auto flex max-w-5xl flex-col px-6 py-16">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-sidebar-primary font-bold text-sidebar-primary-foreground">PS</div>
          <span className="font-semibold text-sidebar-accent-foreground">Portal do Supervisor</span>
        </div>
        <h1 className="mt-16 max-w-2xl text-4xl font-semibold leading-tight text-sidebar-accent-foreground sm:text-5xl">
          Presença, cobertura e faturamento sob controle, contrato a contrato.
        </h1>
        <p className="mt-4 max-w-xl text-sidebar-foreground/80">
          Ausência, justificativa, cobertura do posto, desconto do cliente e custo da cobertura tratados separadamente — como o contrato exige.
        </p>
        <div className="mt-8 flex gap-3">
          <Button asChild size="lg" className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90">
            <Link to="/painel">Entrar no portal</Link>
          </Button>
        </div>
        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((i) => (
            <div key={i.t} className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-4">
              <i.icon className="h-5 w-5 text-sidebar-primary" />
              <p className="mt-3 font-medium text-sidebar-accent-foreground">{i.t}</p>
              <p className="mt-1 text-sm text-sidebar-foreground/70">{i.d}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
