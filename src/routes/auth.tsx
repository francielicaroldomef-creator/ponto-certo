import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { QuickAccessDialog, useTripleClick } from "@/components/quick-access-dialog";

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
// SVG Icons (inline, sem dependência de biblioteca)
// ---------------------------------------------------------------------------
function IconEnvelope() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <polyline points="2,4 12,13 22,4" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function IconEye({ off }: { off?: boolean }) {
  if (off) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconArrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12,5 19,12 12,19" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Logo Caroldo SVG — emblema circular fiel ao original
// ---------------------------------------------------------------------------
function CaroldoEmblem({ size = 120 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      {/* Anel laranja externo */}
      <circle cx="60" cy="60" r="58" fill="url(#logoGrad)" />
      {/* Anel preto separador */}
      <circle cx="60" cy="60" r="53" fill="#000" />
      {/* Fundo laranja interior */}
      <circle cx="60" cy="60" r="48" fill="url(#logoGrad2)" />

      {/* Texto superior em arco */}
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF7020" />
          <stop offset="100%" stopColor="#CC3300" />
        </linearGradient>
        <linearGradient id="logoGrad2" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF6010" />
          <stop offset="100%" stopColor="#C03000" />
        </linearGradient>
        <path id="arcTop" d="M 17,60 A 43,43 0 0 1 103,60" />
        <path id="arcBot" d="M 22,70 A 38,38 0 0 0 98,70" />
      </defs>
      {/* Arco superior */}
      <text fontSize="7.2" fontFamily="Arial Black, sans-serif" fontWeight="900" fill="#000" letterSpacing="0.5">
        <textPath href="#arcTop" startOffset="50%" textAnchor="middle">
          CAROLDO PRESTAÇÃO DE SERVIÇOS LTDA
        </textPath>
      </text>
      {/* Grande C cursivo branco */}
      <text
        x="60" y="74"
        textAnchor="middle"
        fontSize="62"
        fontFamily="Georgia, serif"
        fontStyle="italic"
        fontWeight="900"
        fill="white"
        opacity="0.95"
      >C</text>
      {/* Sobreposição "Caroldo" */}
      <text
        x="60" y="82"
        textAnchor="middle"
        fontSize="10.5"
        fontFamily="Arial Black, sans-serif"
        fontWeight="900"
        fontStyle="italic"
        fill="#000"
        letterSpacing="-0.2"
      >Caroldo</text>
      {/* Arco inferior */}
      <text fontSize="7.5" fontFamily="Arial Black, sans-serif" fontWeight="900" fill="white" letterSpacing="1.5">
        <textPath href="#arcBot" startOffset="50%" textAnchor="middle">
          TRIUNFO · RS
        </textPath>
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Hook: escala proporcional 1672×941 → viewport
// ---------------------------------------------------------------------------
function useSceneScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    function compute() {
      const s = Math.min(window.innerWidth / 1672, window.innerHeight / 941);
      setScale(Math.min(s, 1)); // nunca ampliar além de 100%
    }
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return scale;
}

// ---------------------------------------------------------------------------
// Formulário de autenticação — compartilhado entre desktop e mobile
// ---------------------------------------------------------------------------
interface AuthFormProps {
  onTripleClick: () => void;
  isMobile?: boolean;
}

function AuthForm({ onTripleClick, isMobile = false }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  // Recupera e-mail memorizado
  useEffect(() => {
    try {
      const saved = localStorage.getItem("caroldo_remember_email");
      if (saved) { setEmail(saved); setRememberMe(true); }
    } catch (_) { }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      try {
        if (rememberMe) localStorage.setItem("caroldo_remember_email", email);
        else localStorage.removeItem("caroldo_remember_email");
      } catch (_) { }
      toast.success("Bem-vindo de volta!");
      navigate({ to: "/painel" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na autenticação. Verifique os dados.");
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = () => {
    if (!email) { toast.info("Digite seu e-mail corporativo no campo acima primeiro."); return; }
    toast.promise(
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?reset=true`,
      }),
      {
        loading: "Enviando e-mail de recuperação...",
        success: "Link de recuperação enviado!",
        error: "Não foi possível enviar o e-mail de recuperação.",
      },
    );
  };

  // Estilos dos campos
  const fieldShell: React.CSSProperties = {
    position: "relative",
    height: "60px",
    borderRadius: "14px",
    border: "1px solid #6c6261",
    background: "linear-gradient(100deg, #232124ed, #222224e3)",
    display: "flex",
    alignItems: "center",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };

  const inputBase: React.CSSProperties = {
    flex: 1,
    height: "100%",
    background: "transparent",
    border: "none",
    outline: "none",
    color: "#fff",
    fontSize: "15px",
    fontFamily: "Montserrat, sans-serif",
    paddingLeft: "48px",
    paddingRight: "44px",
  };

  const iconSlot: React.CSSProperties = {
    position: "absolute",
    left: "16px",
    color: "#a09090",
    display: "flex",
    alignItems: "center",
    pointerEvents: "none",
  };

  function focusShell(el: HTMLDivElement | null) {
    if (!el) return;
    el.style.borderColor = "#ff8d43";
    el.style.boxShadow = "0 0 0 3px #ff760026";
  }
  function blurShell(el: HTMLDivElement | null) {
    if (!el) return;
    el.style.borderColor = "#6c6261";
    el.style.boxShadow = "none";
  }

  const emailShellRef = useRef<HTMLDivElement>(null);
  const pwdShellRef = useRef<HTMLDivElement>(null);

  return (
    <div style={{ width: "100%", color: "#fff", fontFamily: "Montserrat, sans-serif" }}>
      {/* Título do card */}
      <h2
        style={{
          fontSize: isMobile ? "22px" : "24px",
          fontWeight: 800,
          lineHeight: 1.3,
          marginBottom: "28px",
          color: "#fff",
        }}
      >
        Comece seu dia com{" "}
        <span style={{ color: "#ff8d43" }}>fé, trabalho e compromisso.</span>
      </h2>

      <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>

        {/* E-mail */}
        <div>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#ccc", marginBottom: "8px" }}>
            E-mail corporativo
          </label>
          <div
            ref={emailShellRef}
            style={fieldShell}
          >
            <span style={iconSlot}><IconEnvelope /></span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="seuemail@caroldo.com.br"
              style={{ ...inputBase, paddingLeft: "50px" }}
              onFocus={() => focusShell(emailShellRef.current)}
              onBlur={() => blurShell(emailShellRef.current)}
            />
          </div>
        </div>

        {/* Senha */}
        <div>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#ccc", marginBottom: "8px" }}>
            Senha
          </label>
          <div
            ref={pwdShellRef}
            style={fieldShell}
          >
            <span style={iconSlot}><IconLock /></span>
            <input
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="current-password"
              placeholder="••••••••••"
              style={{ ...inputBase, paddingRight: "52px" }}
              onFocus={() => focusShell(pwdShellRef.current)}
              onBlur={() => blurShell(pwdShellRef.current)}
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              tabIndex={-1}
              aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
              style={{
                position: "absolute",
                right: "14px",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#a09090",
                display: "flex",
                alignItems: "center",
                padding: "4px",
                borderRadius: "6px",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#a09090")}
            >
              <IconEye off={showPwd} />
            </button>
          </div>
        </div>

        {/* Lembrar + Esqueci */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "13px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: "#d0cece", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ accentColor: "#ff6b00", width: "16px", height: "16px", cursor: "pointer" }}
            />
            Lembrar meu e-mail
          </label>
          <button
            type="button"
            onClick={handleForgotPassword}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#a09090", fontSize: "13px", fontFamily: "Montserrat, sans-serif",
              textDecoration: "none", padding: 0, transition: "color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.textDecoration = "underline"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#a09090"; e.currentTarget.style.textDecoration = "none"; }}
          >
            Esqueci minha senha
          </button>
        </div>

        {/* CTA */}
        <button
          type="submit"
          disabled={busy}
          style={{
            height: "69px",
            borderRadius: "26px",
            border: "none",
            cursor: busy ? "not-allowed" : "pointer",
            background: busy
              ? "linear-gradient(100deg, #994400 0%, #772200 100%)"
              : "linear-gradient(100deg, #ff8b00 0%, #ff5700 57%, #ff4e09 100%)",
            boxShadow: busy ? "none" : "0 10px 27px #fa560052, inset 0 1px 0 #ffb26d60",
            color: "#fff",
            fontSize: "19px",
            fontWeight: 700,
            fontFamily: "Montserrat, sans-serif",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            opacity: busy ? 0.75 : 1,
            transition: "background 0.15s, box-shadow 0.15s, transform 0.1s",
            marginTop: "6px",
            letterSpacing: "-0.2px",
          }}
          onMouseEnter={(e) => {
            if (!busy) {
              e.currentTarget.style.background = "linear-gradient(100deg, #ff9800 0%, #ff6200 57%, #ff5500 100%)";
              e.currentTarget.style.boxShadow = "0 14px 36px #fa560075, inset 0 1px 0 #ffb26d60";
            }
          }}
          onMouseLeave={(e) => {
            if (!busy) {
              e.currentTarget.style.background = "linear-gradient(100deg, #ff8b00 0%, #ff5700 57%, #ff4e09 100%)";
              e.currentTarget.style.boxShadow = "0 10px 27px #fa560052, inset 0 1px 0 #ffb26d60";
            }
          }}
          onMouseDown={(e) => { if (!busy) e.currentTarget.style.transform = "scale(0.98)"; }}
          onMouseUp={(e) => { if (!busy) e.currentTarget.style.transform = "scale(1)"; }}
        >
          <span>{busy ? "Entrando..." : "Entrar na plataforma"}</span>
          {!busy && <IconArrow />}
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cena Desktop — palco 1672×941 com imagem de referência + card posicionado
// ---------------------------------------------------------------------------
function DesktopScene({ scale, onTripleClick }: { scale: number; onTripleClick: () => void }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background: "#08090C",
      }}
    >
      {/* Palco escalável */}
      <div
        style={{
          position: "relative",
          width: "1672px",
          height: "941px",
          transformOrigin: "center center",
          transform: `scale(${scale})`,
          flexShrink: 0,
        }}
      >
        {/* ── Fundo principal: composição 3D com iluminação laranja ── */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: [
              "radial-gradient(ellipse 900px 600px at 70% 50%, rgba(180,60,0,0.28) 0%, transparent 65%)",
              "radial-gradient(ellipse 600px 800px at 85% 20%, rgba(255,100,0,0.18) 0%, transparent 60%)",
              "radial-gradient(ellipse 700px 400px at 50% 95%, rgba(255,85,0,0.13) 0%, transparent 70%)",
              "linear-gradient(160deg, #0c0e12 0%, #0a0b0e 40%, #130d08 100%)",
            ].join(", "),
          }}
        />

        {/* Anéis curvos 3D — coluna central/direita */}
        {/* Anel grande diagonal laranja (superior) */}
        <div
          style={{
            position: "absolute",
            top: "-180px",
            right: "280px",
            width: "780px",
            height: "780px",
            borderRadius: "50%",
            border: "78px solid transparent",
            background: "transparent",
            boxShadow: "0 0 0 0px transparent",
            backgroundImage: "none",
            borderColor: "transparent",
            outline: "none",
            // Anel real via box-shadow e clip
            boxSizing: "border-box",
          }}
        >
          <div style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "78px solid",
            borderColor: "rgba(200,65,0,0.75)",
            transform: "rotate(-18deg) scaleX(0.72)",
            filter: "blur(0.5px)",
            boxShadow: "0 0 60px rgba(255,85,0,0.35), inset 0 0 40px rgba(255,85,0,0.12)",
          }} />
        </div>
        {/* Anel médio laranja escuro (atrás do principal) */}
        <div style={{
          position: "absolute",
          top: "60px",
          right: "120px",
          width: "640px",
          height: "640px",
          borderRadius: "50%",
          border: "58px solid rgba(140,40,0,0.55)",
          transform: "rotate(10deg) scaleX(0.65)",
          filter: "blur(1px)",
          boxShadow: "inset 0 0 30px rgba(255,80,0,0.10)",
        }} />
        {/* Anel pequeno laranja brilhante (primeiro plano) */}
        <div style={{
          position: "absolute",
          top: "220px",
          right: "200px",
          width: "460px",
          height: "460px",
          borderRadius: "50%",
          border: "48px solid rgba(255,80,0,0.60)",
          transform: "rotate(-30deg) scaleX(0.58) scaleY(1.1)",
          filter: "blur(0.3px)",
          boxShadow: "0 0 80px rgba(255,85,0,0.40), inset 0 0 20px rgba(255,100,0,0.10)",
        }} />
        {/* Anel escuro traseiro (profundidade) */}
        <div style={{
          position: "absolute",
          top: "-80px",
          right: "500px",
          width: "860px",
          height: "860px",
          borderRadius: "50%",
          border: "70px solid rgba(50,20,5,0.45)",
          transform: "rotate(5deg) scaleX(0.8)",
          filter: "blur(2px)",
        }} />

        {/* Reflexo de piso laranja */}
        <div style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "180px",
          background: "linear-gradient(to top, rgba(255,70,0,0.12), rgba(255,70,0,0.04), transparent)",
        }} />
        <div style={{
          position: "absolute",
          bottom: "40px",
          left: "10%",
          right: "10%",
          height: "1px",
          background: "linear-gradient(to right, transparent, rgba(255,85,0,0.65), transparent)",
          filter: "blur(1px)",
        }} />

        {/* Glow difuso esquerdo (área de branding) */}
        <div style={{
          position: "absolute",
          top: "50%",
          left: "60px",
          transform: "translateY(-50%)",
          width: "500px",
          height: "500px",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(255,85,0,0.07) 0%, transparent 70%)",
          filter: "blur(8px)",
        }} />

        {/* ── Coluna esquerda: branding ── */}
        <div
          style={{
            position: "absolute",
            left: "92px",
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            flexDirection: "column",
            gap: "32px",
          }}
        >
          {/* Logo com clique triplo */}
          <div
            onClick={onTripleClick}
            title="Portal Caroldo — clique 3× para acesso rápido"
            style={{ cursor: "pointer", display: "inline-block", transition: "transform 0.2s" }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <CaroldoEmblem size={148} />
            {/* Citação Salmo 23 */}
            <div style={{ marginTop: "16px", maxWidth: "380px" }}>
              <p style={{ color: "#e8e8e8", fontSize: "14px", fontStyle: "italic", fontWeight: 400, fontFamily: "Montserrat, sans-serif", lineHeight: 1.5, margin: 0 }}>
                "O senhor é meu pastor, nada me faltará."
              </p>
              <p style={{ color: "#7a7070", fontSize: "11px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", fontFamily: "Montserrat, sans-serif", marginTop: "6px" }}>
                SALMO 23
              </p>
            </div>
          </div>

          {/* Hero headline */}
          <div>
            <h1
              style={{
                fontSize: "88px",
                fontWeight: 900,
                lineHeight: 1.0,
                margin: 0,
                color: "#fff",
                fontFamily: "Montserrat, sans-serif",
                letterSpacing: "-2px",
              }}
            >
              Gestão que<br />
              <span style={{ color: "#FF5500" }}>impulsiona</span><br />
              resultados<span style={{ color: "#FF5500" }}>.</span>
            </h1>
            <p style={{
              color: "#9a9090",
              fontSize: "18px",
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 400,
              marginTop: "16px",
              marginBottom: 0,
            }}>
              Sistema integrado de gestão da Caroldo.
            </p>
            {/* Barra de acento */}
            <div style={{
              marginTop: "20px",
              height: "4px",
              width: "72px",
              borderRadius: "9999px",
              background: "#FF5500",
            }} />
          </div>
        </div>

        {/* ── Card Interativo Desktop (pixel-perfect do spec) ── */}
        <div
          style={{
            position: "absolute",
            left: "949px",
            top: "186px",
            width: "595px",
            minHeight: "578px",
            borderRadius: "31px",
            border: "1.5px solid #ff9b61",
            background: [
              "radial-gradient(ellipse at 96% 0%, rgba(116,47,10,.17), transparent 55%)",
              "linear-gradient(130deg, #161617 0%, #0b0d0e 54%, #21110b 100%)",
            ].join(", "),
            boxShadow: "0 8px 28px #0008, inset 0 0 20px #ff6b0014, 0 0 40px #ff720013",
            padding: "44px 44px 44px 44px",
            boxSizing: "border-box",
          }}
        >
          {/* Brilho glow superior-direito do card */}
          <div style={{
            position: "absolute",
            top: "-60px",
            right: "-60px",
            width: "240px",
            height: "240px",
            borderRadius: "50%",
            background: "rgba(255,90,0,0.15)",
            filter: "blur(50px)",
            pointerEvents: "none",
          }} />
          <AuthForm onTripleClick={onTripleClick} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cena Mobile — reflow vertical com anéis orgânicos
// ---------------------------------------------------------------------------
function MobileScene({ onTripleClick }: { onTripleClick: () => void }) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#0c0d10",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        overflowX: "hidden",
        position: "relative",
      }}
    >
      {/* Anel superior direito */}
      <div style={{
        position: "absolute",
        top: "-160px",
        right: "-160px",
        width: "420px",
        height: "420px",
        borderRadius: "50%",
        border: "68px solid #f76a0a",
        transform: "rotate(35deg)",
        opacity: 0.55,
        pointerEvents: "none",
      }} />
      {/* Anel inferior esquerdo */}
      <div style={{
        position: "absolute",
        bottom: "-140px",
        left: "-140px",
        width: "360px",
        height: "360px",
        borderRadius: "50%",
        border: "63px solid #453e3b",
        opacity: 0.65,
        pointerEvents: "none",
      }} />
      {/* Reflexo de piso */}
      <div style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "100px",
        background: "linear-gradient(to top, rgba(255,70,0,0.09), transparent)",
        pointerEvents: "none",
      }} />

      {/* Header de branding */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: "52px",
          paddingBottom: "28px",
          textAlign: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          onClick={onTripleClick}
          title="Portal Caroldo — clique 3× para acesso rápido"
          style={{ cursor: "pointer" }}
        >
          <CaroldoEmblem size={120} />
        </div>
        <div style={{ marginTop: "14px" }}>
          <p style={{ color: "#ddd", fontSize: "13px", fontStyle: "italic", fontFamily: "Montserrat, sans-serif", margin: 0, lineHeight: 1.5 }}>
            "O senhor é meu pastor, nada me faltará."
          </p>
          <p style={{ color: "#6a6060", fontSize: "10px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", fontFamily: "Montserrat, sans-serif", marginTop: "5px" }}>
            SALMO 23
          </p>
        </div>
        <h1
          style={{
            fontSize: "30px",
            fontWeight: 900,
            color: "#fff",
            fontFamily: "Montserrat, sans-serif",
            marginTop: "20px",
            marginBottom: 0,
            lineHeight: 1.15,
            letterSpacing: "-0.5px",
          }}
        >
          Gestão que{" "}
          <span style={{ color: "#FF5500" }}>impulsiona</span>{" "}
          resultados<span style={{ color: "#FF5500" }}>.</span>
        </h1>
      </div>

      {/* Card mobile */}
      <div
        style={{
          width: "min(480px, calc(100vw - 24px))",
          borderRadius: "28px",
          border: "1.5px solid rgba(255,140,80,0.35)",
          background: "linear-gradient(130deg, #161617 0%, #0b0d0e 54%, #1e1008 100%)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.65), inset 0 0 20px rgba(255,90,0,0.06)",
          padding: "32px 24px",
          boxSizing: "border-box",
          marginBottom: "40px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <AuthForm onTripleClick={onTripleClick} isMobile />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página principal — orquestra desktop vs mobile
// ---------------------------------------------------------------------------
function AuthPage() {
  const [quickOpen, setQuickOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const scale = useSceneScale();

  const handleTripleClick = useTripleClick(() => setQuickOpen(true), 1200);

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 900); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <>
      {/* Google Fonts — Montserrat */}
      <link
        rel="preconnect"
        href="https://fonts.googleapis.com"
      />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin=""
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap"
        rel="stylesheet"
      />

      {isMobile
        ? <MobileScene onTripleClick={handleTripleClick} />
        : <DesktopScene scale={scale} onTripleClick={handleTripleClick} />
      }

      <QuickAccessDialog open={quickOpen} onOpenChange={setQuickOpen} />

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; overflow-x: hidden; }
        ::selection { background: #FF5500; color: #fff; }
        input::placeholder { color: #52525B; }
        input[type="password"]::-ms-reveal,
        input[type="password"]::-webkit-credentials-auto-fill-button { display: none; }
      `}</style>
    </>
  );
}
