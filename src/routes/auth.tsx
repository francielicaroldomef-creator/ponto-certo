/**
 * auth.tsx — Login Corporativo Caroldo
 *
 * Interface 100% responsiva para PC (Full HD, 2K, 4K, notebooks e laptops)
 * e dispositivos móveis, com a identidade visual completa:
 *   • Lado Esquerdo: Logo oficial Caroldo, Salmo 23, headline com tipografia de impacto
 *     e barra de acento neon.
 *   • Lado Direito: Card translúcido em vidro escuro (glassmorphism), bordas brilhantes
 *     sutis (#ff9b61), campos de entrada com ícones SVG e botão de ação neon.
 *   • Fundo: Atmosfera Dark Sci-Fi Corporate com anéis 3D e reflexos no chão.
 *   • Funcionalidades: Autenticação Supabase real, lembrar e-mail, recuperação e atalho
 *     de clique triplo para QuickAccessDialog.
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { QuickAccessDialog, useTripleClick } from "@/components/quick-access-dialog";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Caroldo | Acesso ao sistema de gestão" },
      { name: "description", content: "Sistema integrado de gestão da Caroldo. Acesso corporativo seguro." },
      { name: "theme-color", content: "#08090c" },
    ],
  }),
  component: AuthPage,
});

// ---------------------------------------------------------------------------
// Ícones SVG embutidos de alta precisão
// ---------------------------------------------------------------------------
function IconEnvelope() {
  return (
    <svg className="cl-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="m3 7 9 7 9-7" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg className="cl-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function IconEye({ off }: { off?: boolean }) {
  if (off) {
    return (
      <svg className="cl-eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
        <circle cx="12" cy="12" r="3" />
        <path d="m3 21 18-18" />
      </svg>
    );
  }
  return (
    <svg className="cl-eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg className="cl-btn-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Emblema circular oficial Caroldo (SVG vetorial pixel-perfect)
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
      aria-label="Caroldo Prestação de Serviços"
    >
      <defs>
        <linearGradient id="emblemOrange" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF6A00" />
          <stop offset="100%" stopColor="#D94800" />
        </linearGradient>
        <linearGradient id="emblemInner" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF5C00" />
          <stop offset="100%" stopColor="#C83B00" />
        </linearGradient>
        <path id="txtArcTop" d="M 16,60 A 44,44 0 0 1 104,60" />
        <path id="txtArcBot" d="M 22,70 A 38,38 0 0 0 98,70" />
      </defs>

      {/* Anel exterior laranja */}
      <circle cx="60" cy="60" r="58" fill="url(#emblemOrange)" />
      {/* Anel intermediário preto */}
      <circle cx="60" cy="60" r="53" fill="#000000" />
      {/* Miolo laranja */}
      <circle cx="60" cy="60" r="48" fill="url(#emblemInner)" />

      {/* Texto superior em arco */}
      <text fontSize="7.2" fontFamily="Montserrat, Arial, sans-serif" fontWeight="900" fill="#000000" letterSpacing="0.4">
        <textPath href="#txtArcTop" startOffset="50%" textAnchor="middle">
          CAROLDO PRESTAÇÃO DE SERVIÇOS LTDA
        </textPath>
      </text>

      {/* Monograma C estilizado */}
      <text
        x="60"
        y="75"
        textAnchor="middle"
        fontSize="64"
        fontFamily="Georgia, serif"
        fontStyle="italic"
        fontWeight="900"
        fill="#FFFFFF"
        opacity="0.96"
      >
        C
      </text>

      {/* Sobreposição cursiva 'Caroldo' */}
      <text
        x="60"
        y="83"
        textAnchor="middle"
        fontSize="11"
        fontFamily="Montserrat, Arial Black, sans-serif"
        fontWeight="900"
        fontStyle="italic"
        fill="#000000"
        letterSpacing="-0.3"
      >
        Caroldo
      </text>

      {/* Texto inferior em arco */}
      <text fontSize="7.6" fontFamily="Montserrat, Arial, sans-serif" fontWeight="900" fill="#FFFFFF" letterSpacing="1.8">
        <textPath href="#txtArcBot" startOffset="50%" textAnchor="middle">
          TRIUNFO · RS
        </textPath>
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Formulário Interativo de Login
// ---------------------------------------------------------------------------
interface LoginFormProps {
  busy: boolean;
  onSubmit: (email: string, password: string, remember: boolean) => Promise<void>;
  onForgot: (email: string) => void;
}

function LoginForm({ busy, onSubmit, onForgot }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Recupera e-mail salvo
  useEffect(() => {
    try {
      const saved = localStorage.getItem("caroldo_remember_email");
      if (saved) {
        setEmail(saved);
        setRemember(true);
      }
    } catch (_) {}
  }, []);

  function validateEmail(val: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    let hasError = false;

    if (!validateEmail(email.trim())) {
      setEmailError("Informe um e-mail válido.");
      hasError = true;
    } else {
      setEmailError("");
    }

    if (!password) {
      setPasswordError("Informe sua senha.");
      hasError = true;
    } else {
      setPasswordError("");
    }

    if (hasError) {
      if (!validateEmail(email.trim())) {
        emailInputRef.current?.focus();
      } else {
        passwordInputRef.current?.focus();
      }
      return;
    }

    await onSubmit(email.trim(), password, remember);
  }

  return (
    <form className="cl-form" onSubmit={handleFormSubmit} noValidate>
      {/* Campo E-mail */}
      <div className={`cl-field-block ${emailError ? "has-error" : ""}`}>
        <label htmlFor="user-email" className="cl-label">
          E-mail corporativo
        </label>
        <div className="cl-input-shell">
          <span className="cl-icon-box">
            <IconEnvelope />
          </span>
          <input
            ref={emailInputRef}
            id="user-email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            placeholder="seuemail@caroldo.com.br"
            spellCheck={false}
            required
            value={email}
            aria-invalid={emailError ? "true" : "false"}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError("");
            }}
            className="cl-input"
          />
        </div>
        {emailError && <p className="cl-error-msg" aria-live="polite">{emailError}</p>}
      </div>

      {/* Campo Senha */}
      <div className={`cl-field-block ${passwordError ? "has-error" : ""}`}>
        <label htmlFor="user-password" className="cl-label">
          Senha
        </label>
        <div className="cl-input-shell">
          <span className="cl-icon-box">
            <IconLock />
          </span>
          <input
            ref={passwordInputRef}
            id="user-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••••"
            required
            minLength={1}
            value={password}
            aria-invalid={passwordError ? "true" : "false"}
            onChange={(e) => {
              setPassword(e.target.value);
              if (passwordError) setPasswordError("");
            }}
            className="cl-input cl-input-password"
          />
          <button
            type="button"
            className="cl-eye-btn"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={showPassword}
            onClick={() => {
              setShowPassword((v) => !v);
              passwordInputRef.current?.focus();
            }}
          >
            <IconEye off={showPassword} />
          </button>
        </div>
        {passwordError && <p className="cl-error-msg" aria-live="polite">{passwordError}</p>}
      </div>

      {/* Linha de Ações: Lembrar + Esqueci */}
      <div className="cl-options-row">
        <label className="cl-checkbox-label">
          <input
            type="checkbox"
            name="remember"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="cl-checkbox"
          />
          <span>Lembrar meu e-mail</span>
        </label>
        <button
          type="button"
          className="cl-link-forgot"
          onClick={() => onForgot(email.trim())}
        >
          Esqueci minha senha
        </button>
      </div>

      {/* Botão de Envio CTA */}
      <button type="submit" className="cl-submit-btn" disabled={busy}>
        <span>{busy ? "Validando credenciais…" : "Entrar na plataforma"}</span>
        {!busy && <IconArrowRight />}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Página Principal de Autenticação
// ---------------------------------------------------------------------------
function AuthPage() {
  const [busy, setBusy] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const navigate = useNavigate();

  // Atalho de clique triplo para abrir o QuickAccessDialog
  const handleTripleClick = useTripleClick(() => setQuickOpen(true), 1200);

  async function handleLogin(email: string, password: string, remember: boolean) {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      try {
        if (remember) {
          localStorage.setItem("caroldo_remember_email", email);
        } else {
          localStorage.removeItem("caroldo_remember_email");
        }
      } catch (_) {}

      toast.success("Bem-vindo de volta!");
      navigate({ to: "/painel" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "E-mail ou senha inválidos.");
    } finally {
      setBusy(false);
    }
  }

  function handleForgot(email: string) {
    if (!email) {
      toast.info("Digite seu e-mail corporativo no campo de e-mail primeiro.");
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
  }

  return (
    <>
      {/* Carregamento otimizado da fonte Montserrat */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap"
        rel="stylesheet"
      />

      <div className="cl-root-viewport">
        {/* ── Composição de Iluminação e Efeitos 3D de Fundo ── */}
        <div className="cl-ambient-layer" aria-hidden="true">
          {/* Fundo com arte de referência quando disponível */}
          <div className="cl-bg-cover" />

          {/* Anéis e feixes esculturais luminosos */}
          <div className="cl-ring cl-ring-large" />
          <div className="cl-ring cl-ring-glow" />
          <div className="cl-ring cl-ring-small" />

          {/* Glows radiais de alta energia */}
          <div className="cl-glow cl-glow-top-right" />
          <div className="cl-glow cl-glow-card-back" />
          <div className="cl-glow cl-glow-bottom-left" />

          {/* Reflexo luminoso no piso metálico */}
          <div className="cl-floor-reflection" />
          <div className="cl-floor-beam" />
        </div>

        {/* ── Conteúdo Central Responsivo (Grid 2 Colunas para PC / 1 Coluna para Mobile) ── */}
        <main className="cl-main-wrapper">
          <div className="cl-grid-container">

            {/* ══════════════════════════════════════════════
                COLUNA ESQUERDA: Identidade Visual e Mensagem
               ══════════════════════════════════════════════ */}
            <section className="cl-brand-column">
              {/* Logo oficial e Versículo com clique triplo para credenciais de acesso rápido */}
              <div
                className="cl-brand-header"
                onClick={handleTripleClick}
                title="Portal Caroldo — clique 3× para acesso rápido"
              >
                <CaroldoEmblem size={132} />

                <div className="cl-scripture-box">
                  <p className="cl-verse">“O senhor é meu pastor, nada me faltará.”</p>
                  <p className="cl-verse-author">SALMO 23</p>
                </div>
              </div>

              {/* Headline Hero Corporativa */}
              <div className="cl-hero-text">
                <h1 className="cl-title">
                  Gestão que <br className="cl-br-desktop" />
                  <span className="cl-highlight">impulsiona</span> <br className="cl-br-desktop" />
                  resultados<span className="cl-dot">.</span>
                </h1>
                <p className="cl-subtitle">
                  Sistema integrado de gestão da Caroldo.
                </p>
                <div className="cl-accent-bar" />
              </div>
            </section>

            {/* ══════════════════════════════════════════════
                COLUNA DIREITA: Card de Autenticação Glassmorphism
               ══════════════════════════════════════════════ */}
            <section className="cl-card-column">
              <div className="cl-auth-card">
                {/* Glow sutil interno superior direito do card */}
                <div className="cl-card-ambient-glow" aria-hidden="true" />

                <div className="cl-card-content">
                  <h2 className="cl-card-title">
                    <span>Comece seu dia com</span>
                    <strong>fé, trabalho e compromisso.</strong>
                  </h2>

                  <LoginForm
                    busy={busy}
                    onSubmit={handleLogin}
                    onForgot={handleForgot}
                  />
                </div>
              </div>
            </section>

          </div>
        </main>

        {/* Modal de Acesso Rápido para Administradores / Supervisores */}
        <QuickAccessDialog open={quickOpen} onOpenChange={setQuickOpen} />
      </div>

      {/* ═════════════════════════════════════════════════════════════
          ESTILOS CSS INTEGRADOS: 100% RESPONSIVO PARA PC E MOBILE
         ═════════════════════════════════════════════════════════════ */}
      <style>{`
        /* Reset e Base */
        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        :root {
          --cl-primary-orange: #ff6a00;
          --cl-primary-hot:    #ff5500;
          --cl-border-card:    #ff9b61;
          --cl-bg-dark:        #08090c;
        }

        /* Viewport principal com altura dinâmica e sem overflow horizontal */
        .cl-root-viewport {
          position: relative;
          min-height: 100vh;
          min-height: 100dvh;
          width: 100%;
          background-color: var(--cl-bg-dark);
          color: #ffffff;
          font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          overflow-x: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          -webkit-font-smoothing: antialiased;
        }

        /* ── EFEITOS E AMBIENTE 3D ── */
        .cl-ambient-layer {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 0;
        }

        /* Imagem de referência 3D como background sutil */
        .cl-bg-cover {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 900px 600px at 70% 48%, rgba(255, 90, 0, 0.16) 0%, transparent 70%),
            radial-gradient(ellipse 700px 500px at 20% 90%, rgba(255, 75, 0, 0.09) 0%, transparent 65%),
            radial-gradient(ellipse 600px 800px at 85% 15%, rgba(255, 110, 0, 0.12) 0%, transparent 60%),
            linear-gradient(160deg, #0d0f14 0%, #08090c 45%, #150d08 100%);
          background-size: cover;
        }

        /* Anéis 3D esculturais */
        .cl-ring {
          position: absolute;
          border-radius: 50%;
          box-sizing: border-box;
          pointer-events: none;
        }

        .cl-ring-large {
          top: -120px;
          right: 18%;
          width: 720px;
          height: 720px;
          border: 74px solid rgba(220, 75, 0, 0.72);
          transform: rotate(-22deg) scaleX(0.72);
          filter: blur(0.5px);
          box-shadow: 0 0 70px rgba(255, 85, 0, 0.35), inset 0 0 50px rgba(255, 85, 0, 0.15);
        }

        .cl-ring-glow {
          top: 140px;
          right: 5%;
          width: 580px;
          height: 580px;
          border: 52px solid rgba(170, 50, 0, 0.55);
          transform: rotate(12deg) scaleX(0.66);
          filter: blur(1px);
        }

        .cl-ring-small {
          top: 280px;
          right: 14%;
          width: 440px;
          height: 440px;
          border: 44px solid rgba(255, 90, 0, 0.65);
          transform: rotate(-32deg) scaleX(0.6) scaleY(1.05);
          filter: blur(0.4px);
          box-shadow: 0 0 90px rgba(255, 85, 0, 0.45);
        }

        /* Glows radiais */
        .cl-glow {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }

        .cl-glow-top-right {
          top: -100px;
          right: -100px;
          width: 550px;
          height: 550px;
          background: radial-gradient(circle, rgba(255, 85, 0, 0.22) 0%, transparent 68%);
          filter: blur(20px);
        }

        .cl-glow-card-back {
          top: 50%;
          right: 25%;
          transform: translateY(-50%);
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(255, 85, 0, 0.16) 0%, transparent 68%);
          filter: blur(35px);
        }

        .cl-glow-bottom-left {
          bottom: 5%;
          left: -80px;
          width: 420px;
          height: 420px;
          background: radial-gradient(circle, rgba(255, 85, 0, 0.08) 0%, transparent 70%);
          filter: blur(25px);
        }

        /* Piso luminoso */
        .cl-floor-reflection {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 180px;
          background: linear-gradient(to top, rgba(255, 85, 0, 0.12), rgba(255, 85, 0, 0.03), transparent);
        }

        .cl-floor-beam {
          position: absolute;
          bottom: 36px;
          left: 10%;
          right: 10%;
          height: 1.5px;
          background: linear-gradient(to right, transparent, rgba(255, 90, 0, 0.65), transparent);
          filter: blur(1px);
        }

        /* ── ESTRUTURA PRINCIPAL (DESKTOP E MOBILE) ── */
        .cl-main-wrapper {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 1540px;
          margin: 0 auto;
          padding: 48px 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .cl-grid-container {
          width: 100%;
          display: grid;
          grid-template-columns: 1.15fr 0.95fr;
          gap: 48px;
          align-items: center;
          justify-content: space-between;
        }

        /* ── COLUNA ESQUERDA (BRANDING) ── */
        .cl-brand-column {
          display: flex;
          flex-direction: column;
          gap: 40px;
          padding-left: 16px;
        }

        .cl-brand-header {
          display: inline-flex;
          flex-direction: column;
          align-items: flex-start;
          cursor: pointer;
          user-select: none;
          transition: transform 0.2s ease;
          width: fit-content;
        }

        .cl-brand-header:hover {
          transform: scale(1.02);
        }

        .cl-scripture-box {
          margin-top: 18px;
          max-width: 440px;
        }

        .cl-verse {
          color: #f0f0f2;
          font-size: 14.5px;
          font-style: italic;
          font-weight: 400;
          line-height: 1.5;
        }

        .cl-verse-author {
          color: #8c8994;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          margin-top: 6px;
        }

        .cl-hero-text {
          display: flex;
          flex-direction: column;
        }

        .cl-title {
          font-size: clamp(2.8rem, 5vw, 5.2rem);
          font-weight: 900;
          line-height: 1.04;
          letter-spacing: -1.8px;
          color: #ffffff;
        }

        .cl-highlight {
          color: var(--cl-primary-orange);
        }

        .cl-dot {
          color: var(--cl-primary-orange);
        }

        .cl-subtitle {
          color: #a3a1ab;
          font-size: clamp(1rem, 1.4vw, 1.25rem);
          font-weight: 400;
          margin-top: 20px;
        }

        .cl-accent-bar {
          margin-top: 24px;
          height: 4px;
          width: 72px;
          border-radius: 9999px;
          background: var(--cl-primary-orange);
          box-shadow: 0 0 16px rgba(255, 106, 0, 0.6);
        }

        /* ── COLUNA DIREITA (CARD) ── */
        .cl-card-column {
          display: flex;
          justify-content: flex-end;
          width: 100%;
        }

        .cl-auth-card {
          position: relative;
          width: 100%;
          max-width: 580px;
          min-height: 570px;
          border-radius: 31px;
          border: 1.5px solid var(--cl-border-card);
          background:
            radial-gradient(ellipse at 96% 0%, rgba(116, 47, 10, 0.22), transparent 55%),
            linear-gradient(130deg, #17181c 0%, #0d0f12 54%, #22120a 100%);
          box-shadow:
            0 16px 48px rgba(0, 0, 0, 0.75),
            inset 0 0 20px rgba(255, 107, 0, 0.08),
            0 0 45px rgba(255, 114, 0, 0.12);
          padding: 48px 52px;
          backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);
          isolation: isolate;
        }

        .cl-card-ambient-glow {
          position: absolute;
          top: -40px;
          right: -40px;
          width: 200px;
          height: 200px;
          border-radius: 50%;
          background: rgba(255, 106, 0, 0.15);
          filter: blur(45px);
          pointer-events: none;
          z-index: -1;
        }

        .cl-card-content {
          position: relative;
          z-index: 1;
        }

        .cl-card-title {
          font-weight: 800;
          letter-spacing: -1.2px;
          line-height: 1.2;
          margin-bottom: 34px;
          font-size: clamp(26px, 2.5vw, 34px);
        }

        .cl-card-title span {
          display: block;
          color: #ffffff;
        }

        .cl-card-title strong {
          display: block;
          color: var(--cl-primary-orange);
          font-weight: 800;
          letter-spacing: -1.2px;
          margin-top: 2px;
        }

        /* ── FORMULÁRIO E CAMPOS ── */
        .cl-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .cl-field-block {
          position: relative;
          display: flex;
          flex-direction: column;
        }

        .cl-label {
          display: block;
          font-size: 15px;
          font-weight: 600;
          color: #d6d5dc;
          margin-bottom: 9px;
          line-height: 1.2;
        }

        .cl-input-shell {
          position: relative;
          display: flex;
          align-items: center;
          height: 60px;
          border-radius: 14px;
          border: 1px solid #5a5457;
          background: linear-gradient(100deg, rgba(35, 33, 36, 0.94), rgba(34, 34, 36, 0.90));
          transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }

        .cl-input-shell:focus-within {
          border-color: #ff8d43;
          box-shadow: 0 0 0 3px rgba(255, 118, 0, 0.22);
        }

        .cl-field-block.has-error .cl-input-shell {
          border-color: #ff6a6a;
        }

        .cl-icon-box {
          position: absolute;
          left: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #9c99a4;
          pointer-events: none;
        }

        .cl-input-icon {
          width: 23px;
          height: 23px;
          stroke: #ffffff;
        }

        .cl-input {
          flex: 1;
          height: 100%;
          background: transparent;
          border: none;
          outline: none;
          color: #ffffff;
          font-size: 15px;
          font-family: inherit;
          padding-left: 54px;
          padding-right: 18px;
          letter-spacing: -0.3px;
        }

        .cl-input-password {
          padding-right: 52px;
        }

        .cl-input::placeholder {
          color: #8c8994;
          opacity: 1;
        }

        .cl-input:-webkit-autofill {
          -webkit-text-fill-color: #ffffff;
          transition: background-color 999999s;
        }

        .cl-eye-btn {
          position: absolute;
          right: 12px;
          height: 42px;
          width: 42px;
          background: transparent;
          border: none;
          color: #a3a1ab;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          cursor: pointer;
          transition: color 0.15s ease, background 0.15s ease;
        }

        .cl-eye-btn:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.08);
        }

        .cl-eye-icon {
          width: 22px;
          height: 22px;
        }

        .cl-error-msg {
          font-size: 11.5px;
          color: #ff9b85;
          margin-top: 5px;
          padding-left: 4px;
        }

        /* ── LINHA DE OPÇÕES (LEMBRAR E-MAIL E ESQUECI SENHA) ── */
        .cl-options-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13.5px;
          color: #c5c3cc;
          margin-top: 4px;
          margin-bottom: 8px;
        }

        .cl-checkbox-label {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          user-select: none;
        }

        .cl-checkbox {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 5px;
          border: 1.5px solid #827271;
          background: #141417;
          display: grid;
          place-content: center;
          cursor: pointer;
          transition: border-color 0.15s ease, background-color 0.15s ease;
        }

        .cl-checkbox:checked {
          background-color: var(--cl-primary-orange);
          border-color: var(--cl-primary-orange);
        }

        .cl-checkbox:checked::after {
          content: "";
          width: 10px;
          height: 6px;
          border: solid #ffffff;
          border-width: 0 0 2.2px 2.2px;
          transform: rotate(-45deg) translate(0, -1.5px);
        }

        .cl-link-forgot {
          background: none;
          border: none;
          color: #a8a6b1;
          font-size: 13.5px;
          font-family: inherit;
          cursor: pointer;
          transition: color 0.15s ease;
          padding: 4px 0;
        }

        .cl-link-forgot:hover {
          color: #ffffff;
          text-decoration: underline;
        }

        /* ── BOTÃO DE SUBMIT CTA ── */
        .cl-submit-btn {
          height: 68px;
          width: 100%;
          border: none;
          border-radius: 24px;
          background: linear-gradient(100deg, #ff8b00 0%, #ff5700 57%, #ff4705 100%);
          box-shadow: 0 10px 28px rgba(250, 86, 0, 0.42), inset 0 1px 0 rgba(255, 178, 109, 0.45);
          color: #ffffff;
          font-size: 18.5px;
          font-weight: 700;
          letter-spacing: -0.4px;
          font-family: inherit;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          cursor: pointer;
          transition: filter 0.18s ease, transform 0.15s ease, box-shadow 0.18s ease;
          margin-top: 6px;
        }

        .cl-submit-btn:hover:not(:disabled) {
          filter: brightness(1.08);
          transform: translateY(-1.5px);
          box-shadow: 0 14px 34px rgba(250, 86, 0, 0.55), inset 0 1px 0 rgba(255, 178, 109, 0.55);
        }

        .cl-submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .cl-submit-btn:disabled {
          opacity: 0.72;
          cursor: not-allowed;
          filter: grayscale(0.2);
        }

        .cl-btn-arrow {
          width: 22px;
          height: 22px;
          transition: transform 0.15s ease;
        }

        .cl-submit-btn:hover:not(:disabled) .cl-btn-arrow {
          transform: translateX(3px);
        }

        /* ── RESPONSIVIDADE FLUIDA (DESKTOP MÉDIO / NOTEBOOKS / LAPTOPS) ── */
        @media (max-width: 1200px) {
          .cl-grid-container {
            grid-template-columns: 1fr 1fr;
            gap: 36px;
          }
          .cl-auth-card {
            padding: 40px 36px;
          }
          .cl-title {
            font-size: clamp(2.4rem, 4.2vw, 4rem);
          }
        }

        /* ── RESPONSIVIDADE MOBILE E TABLET VERTICAL (< 960px) ── */
        @media (max-width: 960px) {
          .cl-root-viewport {
            padding: 32px 16px;
            align-items: flex-start;
          }

          .cl-main-wrapper {
            padding: 16px 8px;
          }

          .cl-grid-container {
            grid-template-columns: 1fr;
            gap: 40px;
          }

          .cl-brand-column {
            padding-left: 0;
            align-items: center;
            text-align: center;
            gap: 28px;
          }

          .cl-brand-header {
            align-items: center;
          }

          .cl-br-desktop {
            display: none;
          }

          .cl-accent-bar {
            margin: 18px auto 0;
          }

          .cl-card-column {
            justify-content: center;
          }

          .cl-auth-card {
            max-width: 490px;
            padding: 34px 26px;
            border-radius: 26px;
          }

          .cl-card-title {
            text-align: center;
            font-size: 24px;
            margin-bottom: 26px;
          }

          .cl-card-title strong {
            white-space: normal;
          }

          .cl-ring-large, .cl-ring-glow, .cl-ring-small {
            opacity: 0.35;
          }
        }

        /* ── TELAS ULTRA COMPACTAS (< 400px) ── */
        @media (max-width: 400px) {
          .cl-auth-card {
            padding: 28px 18px;
          }
          .cl-options-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          .cl-submit-btn {
            height: 60px;
            font-size: 16.5px;
          }
        }
      `}</style>
    </>
  );
}
