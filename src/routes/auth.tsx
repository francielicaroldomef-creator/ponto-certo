import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui-kit";

import { QuickAccessDialog, useTripleClick } from "@/components/quick-access-dialog";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Portal do Supervisor" },
      { name: "description", content: "Acesse o Portal do Supervisor com seu e-mail e senha." },
      { property: "og:title", content: "Entrar — Portal do Supervisor" },
      { property: "og:description", content: "Acesso ao Portal do Supervisor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const handleTripleClick = useTripleClick(() => setQuickOpen(true), 1200);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/painel" });
      } else {
        const { error } = await supabase.auth.signUp({
          email, password, options: { emailRedirectTo: window.location.origin + "/painel", data: { full_name: name } },
        });
        if (error) throw error;
        toast.success("Conta criada. Confirme pelo link enviado ao seu e-mail.");
        setMode("in");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na autenticação");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-sidebar p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="p-6">
          <div
            className="mb-6 flex items-center gap-2 cursor-pointer select-none transition-opacity active:opacity-75"
            onClick={handleTripleClick}
            title="Portal do Supervisor"
          >
            <div className="grid h-9 w-9 place-items-center rounded-md bg-primary font-bold text-primary-foreground shadow-sm">PS</div>
            <div>
              <p className="font-semibold">Portal do Supervisor</p>
              <p className="text-xs text-muted-foreground">{mode === "in" ? "Entre com sua conta" : "Crie sua conta"}</p>
            </div>
          </div>
          <form onSubmit={submit} className="flex flex-col gap-4">
            {mode === "up" && <Field label="Nome completo"><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>}
            <Field label="E-mail"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
            <Field label="Senha"><Input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
            <Button type="submit" disabled={busy}>{busy ? "Aguarde..." : mode === "in" ? "Entrar" : "Criar conta"}</Button>
          </form>
          <button type="button" className="mt-4 w-full text-center text-sm text-primary hover:underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
          </button>
          <p className="mt-4 text-xs text-muted-foreground">O primeiro usuário cadastrado torna-se Administrador. Os demais aguardam atribuição de perfil.</p>
        </CardContent>
      </Card>
      <QuickAccessDialog open={quickOpen} onOpenChange={setQuickOpen} />
    </div>
  );
}
