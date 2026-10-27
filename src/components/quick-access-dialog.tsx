import { useState, useRef, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Eye, EyeOff, ShieldCheck, Lock } from "lucide-react";
import { authenticateQuickAccess } from "@/lib/quick-access";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Hook para detectar 3 cliques rápidos dentro de um intervalo máximo (padrão 1200ms).
 */
export function useTripleClick(onTrigger: () => void, maxIntervalMs = 1200) {
  const clickCount = useRef(0);
  const firstClickTime = useRef(0);

  const handleClick = useCallback(() => {
    const now = Date.now();
    if (clickCount.current === 0 || now - firstClickTime.current > maxIntervalMs) {
      clickCount.current = 1;
      firstClickTime.current = now;
      return;
    }

    clickCount.current += 1;
    if (clickCount.current >= 3) {
      clickCount.current = 0;
      firstClickTime.current = 0;
      onTrigger();
    }
  }, [onTrigger, maxIntervalMs]);

  return handleClick;
}

export function QuickAccessDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const handleClose = () => {
    setPassword("");
    setErrorMsg("");
    setShowPassword(false);
    onOpenChange(false);
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password.trim()) {
      setErrorMsg("Digite a senha para acessar.");
      return;
    }

    setBusy(true);
    setErrorMsg("");

    try {
      const res = await authenticateQuickAccess(password);
      if (!res.success || !res.session) {
        setErrorMsg(res.error || "Senha incorreta ou acesso inativo.");
        return;
      }

      // Invalida caches para atualizar perfil, contratos e apuração
      await qc.invalidateQueries({ queryKey: ["me"] });
      await qc.invalidateQueries({ queryKey: ["contracts"] });
      await qc.invalidateQueries({ queryKey: ["period"] });

      if (res.session.isMasterAdmin) {
        toast.success("Bem-vinda, Francieli! Acesso administrativo liberado.", {
          icon: <ShieldCheck className="h-5 w-5 text-emerald-500" />,
        });
        handleClose();
        navigate({ to: "/painel" });
      } else {
        toast.success(`Bem-vindo(a), ${res.session.name}! Acesso liberado.`, {
          icon: <KeyRound className="h-5 w-5 text-primary" />,
        });
        handleClose();
        const firstModule = res.session.allowedModules[0] || "/painel";
        navigate({ to: firstModule as any });
      }
    } catch {
      setErrorMsg("Ocorreu um erro ao validar o acesso.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? handleClose() : onOpenChange(true))}>
      <DialogContent className="max-w-md sm:max-w-[420px]">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-lg">Acesso ao Sistema</DialogTitle>
          <DialogDescription className="text-center text-xs">
            Informe sua credencial ou senha master autorizada.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleLogin} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Digite a senha..."
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg("");
                }}
                className={`pr-10 ${errorMsg ? "border-destructive focus-visible:ring-destructive" : ""}`}
                autoFocus
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errorMsg && <p className="text-xs font-medium text-destructive">{errorMsg}</p>}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={handleClose} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy || !password.trim()}>
              {busy ? "Validando…" : "Acessar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
