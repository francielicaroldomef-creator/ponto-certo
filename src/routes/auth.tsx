import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { QuickAccessDialog, useTripleClick } from "@/components/quick-access-dialog";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Portal Caroldo — Entrar" },
      { name: "description", content: "Acesso corporativo ao sistema integrado de gestão Caroldo." },
      { property: "og:title", content: "Portal Caroldo — Entrar" },
      { property: "og:description", content: "Sistema integrado de gestão da Caroldo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

// ---------------------------------------------------------------------------
// Emblema circular da Caroldo
// ---------------------------------------------------------------------------
function CaroldoLogo({ onTripleClick }: { onTripleClick: () => void }) {
  return (
    <div
      onClick={onTripleClick}
      title="Portal Caroldo — clique 3× para acesso rápido"
      className="cursor-pointer select-none transition-transform hover:scale-105 active:scale-95 flex flex-col items-start"
    >
      {/* Anel externo laranja */}
      <div
        className="relative w-28 h-28 rounded-full flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg, #FF5500 0%, #CC3300 100%)",
          boxShadow: "0 0 32px rgba(255,85,0,0.45), 0 8px 24px rgba(0,0,0,0.6)",
        }}
      >
        {/* Anel interno preto que cria a borda de separação */}
        <div className="w-[calc(100%-6px)] h-[calc(100%-6px)] rounded-full bg-black flex items-center justify-center">
          {/* Área interna laranja */}
          <div
            className="w-[calc(100%-6px)] h-[calc(100%-6px)] rounded-full flex flex-col items-center justify-between py-2 px-1 overflow-hidden"
            style={{ background: "linear-gradient(160deg, #FF5500 0%, #CC3300 100%)" }}
          >
            {/* Texto arco superior */}
            <span
              className="text-center leading-none font-black text-black uppercase"
              style={{ fontSize: "6px", letterSpacing: "0.04em", lineHeight: 1.1 }}
            >
              CAROLDO PRESTAÇÃO DE SERVIÇOS LTDA
            </span>

            {/* Monograma central */}
            <div className="relative flex items-center justify-center flex-1">
              {/* Grande C cursivo branco */}
              <span
                className="text-white font-serif select-none leading-none"
                style={{ fontSize: "52px", fontStyle: "italic", fontWeight: 900, lineHeight: 1, marginTop: "-4px" }}
              >
                C
              </span>
              {/* Sobreposição "Caroldo" em preto negrito */}
              <span
                className="absolute font-extrabold italic text-black uppercase tracking-tighter select-none"
                style={{ fontSize: "10px", bottom: "4px", left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap" }}
              >
                Caroldo
              </span>
            </div>

            {/* Texto arco inferior */}
            <span
              className="text-white font-bold uppercase tracking-widest leading-none"
              style={{ fontSize: "7px", letterSpacing: "0.12em" }}
            >
              TRIUNFO - RS
            </span>
          </div>
        </div>
      </div>

      {/* Citação Salmo 23 */}
      <div className="mt-5">
        <p className="text-white text-sm font-light italic tracking-wide leading-snug">
          "O senhor é meu pastor, nada me faltará."
        </p>
        <p className="text-zinc-400 text-[11px] font-semibold tracking-[0.25em] uppercase mt-1">
          SALMO 23
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------
function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  const handleTripleClick = useTripleClick(() => setQuickOpen(true), 1200);
  const navigate = useNavigate();

  // Recupera e-mail memorizado
  useEffect(() => {
    try {
      const saved = localStorage.getItem("caroldo_remember_email");
      if (saved) {
        setEmail(saved);
        setRememberMe(true);
      }
    } catch (_) {}
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      try {
        if (rememberMe) {
          localStorage.setItem("caroldo_remember_email", email);
        } else {
          localStorage.removeItem("caroldo_remember_email");
        }
      } catch (_) {}

      toast.success("Bem-vindo de volta!");
      navigate({ to: "/painel" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na autenticação. Verifique os dados.");
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = () => {
    if (!email) {
      toast.info("Digite seu e-mail corporativo no campo acima primeiro.");
      return;
    }
    toast.promise(
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?reset=true`,
      }),
      {
        loading: "Enviando e-mail de recuperação...",
        success: "Link de recuperação enviado para o seu e-mail corporativo!",
        error: "Não foi possível enviar o e-mail de recuperação.",
      }
    );
  };

  return (
    <div
      className="relative min-h-screen w-full text-white flex items-center justify-center p-4 lg:p-12 overflow-x-hidden font-sans"
      style={{
        background: "#08090C",
        // Seleção de texto com laranja
      }}
    >
      {/* ── Camada de efeitos de iluminação ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {/* Glow laranja superior direito */}
        <div
          className="absolute rounded-full"
          style={{
            top: "-160px",
            right: "-160px",
            width: "620px",
            height: "620px",
            background: "radial-gradient(circle, rgba(255,85,0,0.22) 0%, transparent 70%)",
            filter: "blur(8px)",
          }}
        />
        {/* Glow central (atrás do card) */}
        <div
          className="absolute"
          style={{
            top: "50%",
            right: "20%",
            transform: "translateY(-50%)",
            width: "480px",
            height: "480px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,85,0,0.14) 0%, transparent 70%)",
            filter: "blur(10px)",
          }}
        />
        {/* Anéis esculturais 3D — simulados com gradientes curvos */}
        <div
          className="absolute"
          style={{
            top: "10%",
            right: "5%",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            border: "60px solid transparent",
            backgroundImage: "radial-gradient(ellipse at 50% 50%, rgba(255,85,0,0.18) 0%, transparent 70%)",
            transform: "rotate(-20deg) scaleX(0.55)",
            filter: "blur(2px)",
          }}
        />
        {/* Reflexo no chão — linha laranja */}
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{
            height: "140px",
            background: "linear-gradient(to top, rgba(255,85,0,0.10), rgba(255,85,0,0.04), transparent)",
          }}
        />
        <div
          className="absolute"
          style={{
            bottom: "32px",
            left: "20%",
            right: "20%",
            height: "1px",
            background: "linear-gradient(to right, transparent, rgba(255,85,0,0.55), transparent)",
            filter: "blur(1px)",
          }}
        />
        {/* Glow sutil esquerdo (área do branding) */}
        <div
          className="absolute rounded-full"
          style={{
            bottom: "10%",
            left: "-80px",
            width: "360px",
            height: "240px",
            background: "radial-gradient(ellipse, rgba(255,85,0,0.08) 0%, transparent 70%)",
            filter: "blur(6px)",
          }}
        />
      </div>

      {/* ── Grid de conteúdo ── */}
      <div className="relative z-10 w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">

        {/* ═══════════════════════════════════════
            COLUNA ESQUERDA — Branding & Headline
            ═══════════════════════════════════════ */}
        <div className="lg:col-span-7 flex flex-col justify-center space-y-8">
          {/* Logo com clique triplo */}
          <CaroldoLogo onTripleClick={handleTripleClick} />

          {/* Hero Headline */}
          <div className="space-y-1">
            <h1
              className="leading-[1.05] tracking-tight text-white"
              style={{ fontSize: "clamp(2.8rem, 5vw, 5rem)", fontWeight: 900 }}
            >
              Gestão que <br />
              <span style={{ color: "#FF5500" }}>impulsiona</span> <br />
              resultados<span style={{ color: "#FF5500" }}>.</span>
            </h1>
            <p className="text-zinc-400 text-base sm:text-lg font-normal pt-2">
              Sistema integrado de gestão da Caroldo.
            </p>
            {/* Barra de acento laranja */}
            <div
              className="rounded-full mt-4"
              style={{ height: "4px", width: "64px", background: "#FF5500" }}
            />
          </div>
        </div>

        {/* ═══════════════════════════════════════
            COLUNA DIREITA — Card Glassmorphism
            ═══════════════════════════════════════ */}
        <div className="lg:col-span-5 flex justify-center lg:justify-end">
          <div
            className="w-full relative overflow-hidden"
            style={{
              maxWidth: "448px",
              borderRadius: "28px",
              padding: "40px",
              background: "rgba(14, 15, 20, 0.72)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: "0 32px 80px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            {/* Brilho sutil superior-direito do card */}
            <div
              className="absolute pointer-events-none"
              aria-hidden="true"
              style={{
                top: "-40px",
                right: "-40px",
                width: "200px",
                height: "200px",
                borderRadius: "50%",
                background: "rgba(255,85,0,0.12)",
                filter: "blur(40px)",
              }}
            />

            {/* Título do card */}
            <div className="mb-7 relative z-10">
              <h2 className="text-2xl font-bold leading-snug text-white">
                Comece seu dia com <br />
                <span style={{ color: "#FF5500" }}>fé, trabalho e compromisso.</span>
              </h2>
            </div>

            {/* Formulário */}
            <form onSubmit={handleLogin} className="space-y-5 relative z-10">

              {/* ── Campo E-mail ── */}
              <div className="space-y-1.5">
                <label
                  htmlFor="caroldo-email"
                  className="block text-sm font-medium"
                  style={{ color: "#E4E4E7" }}
                >
                  E-mail corporativo
                </label>
                <div className="relative">
                  <span
                    className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none"
                    style={{ color: "#71717A" }}
                  >
                    <Mail className="w-[18px] h-[18px]" />
                  </span>
                  <input
                    id="caroldo-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="seuemail@caroldo.com.br"
                    style={{
                      width: "100%",
                      paddingLeft: "44px",
                      paddingRight: "16px",
                      paddingTop: "12px",
                      paddingBottom: "12px",
                      borderRadius: "12px",
                      background: "rgba(24, 24, 27, 0.80)",
                      border: "1px solid rgba(63,63,70,0.70)",
                      color: "#FFFFFF",
                      fontSize: "14px",
                      outline: "none",
                      transition: "border-color 0.15s, box-shadow 0.15s",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#FF5500";
                      e.currentTarget.style.boxShadow = "0 0 0 1px #FF5500";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "rgba(63,63,70,0.70)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                </div>
              </div>

              {/* ── Campo Senha ── */}
              <div className="space-y-1.5">
                <label
                  htmlFor="caroldo-password"
                  className="block text-sm font-medium"
                  style={{ color: "#E4E4E7" }}
                >
                  Senha
                </label>
                <div className="relative">
                  <span
                    className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none"
                    style={{ color: "#71717A" }}
                  >
                    <Lock className="w-[18px] h-[18px]" />
                  </span>
                  <input
                    id="caroldo-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="current-password"
                    placeholder="••••••••••"
                    style={{
                      width: "100%",
                      paddingLeft: "44px",
                      paddingRight: "44px",
                      paddingTop: "12px",
                      paddingBottom: "12px",
                      borderRadius: "12px",
                      background: "rgba(24, 24, 27, 0.80)",
                      border: "1px solid rgba(63,63,70,0.70)",
                      color: "#FFFFFF",
                      fontSize: "14px",
                      outline: "none",
                      transition: "border-color 0.15s, box-shadow 0.15s",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#FF5500";
                      e.currentTarget.style.boxShadow = "0 0 0 1px #FF5500";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "rgba(63,63,70,0.70)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                  {/* Toggle visibilidade de senha */}
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 transition-colors"
                    style={{ color: "#71717A" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#FFFFFF")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#71717A")}
                  >
                    {showPassword
                      ? <EyeOff className="w-[18px] h-[18px]" />
                      : <Eye className="w-[18px] h-[18px]" />
                    }
                  </button>
                </div>
              </div>

              {/* ── Lembrar e-mail + Esqueci senha ── */}
              <div className="flex items-center justify-between pt-0.5" style={{ fontSize: "13px" }}>
                <label
                  className="flex items-center gap-2 cursor-pointer select-none transition-colors"
                  style={{ color: "#D4D4D8" }}
                >
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{ accentColor: "#FF5500", width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  <span>Lembrar meu e-mail</span>
                </label>

                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="transition-colors"
                  style={{ color: "#A1A1AA" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#FFFFFF")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#A1A1AA")}
                >
                  Esqueci minha senha
                </button>
              </div>

              {/* ── Botão CTA ── */}
              <button
                type="submit"
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 font-semibold text-white transition-all"
                style={{
                  marginTop: "8px",
                  padding: "14px 24px",
                  borderRadius: "14px",
                  background: busy ? "#994400" : "#FF5500",
                  boxShadow: busy ? "none" : "0 8px 30px rgba(255,85,0,0.38), 0 2px 8px rgba(0,0,0,0.4)",
                  fontSize: "15px",
                  cursor: busy ? "not-allowed" : "pointer",
                  opacity: busy ? 0.7 : 1,
                  transform: "scale(1)",
                  transition: "background 0.15s, box-shadow 0.15s, opacity 0.15s",
                  border: "none",
                }}
                onMouseEnter={(e) => {
                  if (!busy) {
                    e.currentTarget.style.background = "#E64A00";
                    e.currentTarget.style.boxShadow = "0 10px 36px rgba(255,85,0,0.50), 0 2px 8px rgba(0,0,0,0.4)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!busy) {
                    e.currentTarget.style.background = "#FF5500";
                    e.currentTarget.style.boxShadow = "0 8px 30px rgba(255,85,0,0.38), 0 2px 8px rgba(0,0,0,0.4)";
                  }
                }}
                onMouseDown={(e) => { if (!busy) e.currentTarget.style.transform = "scale(0.985)"; }}
                onMouseUp={(e) => { if (!busy) e.currentTarget.style.transform = "scale(1)"; }}
              >
                <span>{busy ? "Entrando..." : "Entrar na plataforma"}</span>
                {!busy && <ArrowRight className="w-[18px] h-[18px]" />}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* ── Modal de Acesso Rápido (clique triplo no logo) ── */}
      <QuickAccessDialog open={quickOpen} onOpenChange={setQuickOpen} />

      {/* Hack global de selection color via style tag inline */}
      <style>{`
        ::selection { background: #FF5500; color: #fff; }
        input::placeholder { color: #52525B; }
      `}</style>
    </div>
  );
}
