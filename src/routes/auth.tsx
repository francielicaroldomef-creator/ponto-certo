/**
 * auth.tsx — Login Corporativo Caroldo
 *
 * Layout fiel ao pacote caroldo-login-frontend:
 *   • Desktop: palco 1672×941 com `referencia-desktop.png` como arte-base +
 *              card interativo posicionado em pixel-perfect (left:949 top:186)
 *   • Mobile:  reflow vertical com anéis orgânicos + `logo-caroldo.png`
 *
 * CSS idêntico ao styles.css do pacote — apenas adaptado para <style> inline
 * (sem classe global para não vazar ao resto do app).
 * Autenticação real via Supabase; clique-triplo → QuickAccessDialog.
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
      { name: "theme-color", content: "#0b0b0d" },
    ],
  }),
  component: AuthPage,
});

// ---------------------------------------------------------------------------
// SVG inline idênticos ao pacote original
// ---------------------------------------------------------------------------
function SvgEnvelope() {
  return (
    <svg className="cl-field-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="m3 7 9 7 9-7" />
    </svg>
  );
}
function SvgLock() {
  return (
    <svg className="cl-field-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
function SvgEyeToggle({ visible }: { visible: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="cl-eye-svg">
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="3" />
      {!visible && <path d="m3 21 18-18" />}
    </svg>
  );
}
function SvgArrow() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="cl-cta-arrow">
      <path d="M4 12h16m-6-6 6 6-6 6" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Formulário — compartilhado entre desktop e mobile
// ---------------------------------------------------------------------------
interface LoginFormProps {
  emailId: string;
  passwordId: string;
  busy: boolean;
  onSubmit: (email: string, password: string, remember: boolean) => Promise<void>;
  onForgot: (email: string) => void;
}

function LoginForm({ emailId, passwordId, busy, onSubmit, onForgot }: LoginFormProps) {
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [remember, setRemember]   = useState(false);
  const [showPwd, setShowPwd]     = useState(false);
  const [emailErr, setEmailErr]   = useState("");
  const [pwdErr, setPwdErr]       = useState("");
  const emailRef                  = useRef<HTMLInputElement>(null);
  const pwdRef                    = useRef<HTMLInputElement>(null);

  // Recupera e-mail memorizado
  useEffect(() => {
    try {
      const saved = localStorage.getItem("caroldo_remember_email");
      if (saved) { setEmail(saved); setRemember(true); }
    } catch (_) {}
  }, []);

  function validateEmail(v: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let valid = true;
    if (!validateEmail(email.trim())) { setEmailErr("Informe um e-mail válido."); valid = false; } else setEmailErr("");
    if (!password) { setPwdErr("Informe sua senha."); valid = false; } else setPwdErr("");
    if (!valid) {
      (emailErr ? emailRef : pwdRef).current?.focus();
      return;
    }
    await onSubmit(email.trim(), password, remember);
  }

  return (
    <form className="cl-login-form" onSubmit={handleSubmit} noValidate>
      {/* E-mail */}
      <div className={`cl-field-group${emailErr ? " cl-has-error" : ""}`}>
        <label htmlFor={emailId}>E-mail corporativo</label>
        <div className="cl-field-shell">
          <SvgEnvelope />
          <input
            ref={emailRef}
            id={emailId}
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            placeholder="seuemail@caroldo.com.br"
            spellCheck={false}
            required
            value={email}
            aria-invalid={emailErr ? "true" : "false"}
            onChange={(e) => { setEmail(e.target.value); setEmailErr(""); }}
          />
        </div>
        <p className="cl-field-error" aria-live="polite">{emailErr}</p>
      </div>

      {/* Senha */}
      <div className={`cl-field-group cl-password-group${pwdErr ? " cl-has-error" : ""}`}>
        <label htmlFor={passwordId}>Senha</label>
        <div className="cl-field-shell">
          <SvgLock />
          <input
            ref={pwdRef}
            id={passwordId}
            name="password"
            type={showPwd ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Digite sua senha"
            required
            minLength={1}
            value={password}
            aria-invalid={pwdErr ? "true" : "false"}
            onChange={(e) => { setPassword(e.target.value); setPwdErr(""); }}
          />
          <button
            type="button"
            className="cl-reveal"
            aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={showPwd}
            onClick={() => { setShowPwd((v) => !v); pwdRef.current?.focus(); }}
          >
            <SvgEyeToggle visible={showPwd} />
          </button>
        </div>
        <p className="cl-field-error" aria-live="polite">{pwdErr}</p>
      </div>

      {/* Lembrar + Esqueci */}
      <div className="cl-actions-row">
        <label className="cl-remember">
          <input
            type="checkbox"
            name="remember"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <span>Lembrar meu e-mail</span>
        </label>
        <button
          type="button"
          className="cl-forgot"
          onClick={() => onForgot(email.trim())}
        >
          Esqueci minha senha
        </button>
      </div>

      {/* CTA */}
      <button type="submit" className="cl-submit-button" disabled={busy}>
        <span>{busy ? "Validando credenciais…" : "Entrar na plataforma"}</span>
        {!busy && <SvgArrow />}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------
function AuthPage() {
  const [busy, setBusy]           = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const navigate = useNavigate();

  // Escala proporcional 1672×941
  useEffect(() => {
    const stage = document.getElementById("cl-desktop-stage");
    function scale() {
      const s = Math.min(window.innerWidth / 1672, window.innerHeight / 941);
      stage?.style.setProperty("--scene-scale", String(s));
    }
    scale();
    window.addEventListener("resize", scale, { passive: true });
    return () => window.removeEventListener("resize", scale);
  }, []);

  const handleTripleClick = useTripleClick(() => setQuickOpen(true), 1200);

  async function handleLogin(email: string, password: string, remember: boolean) {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      try {
        if (remember) localStorage.setItem("caroldo_remember_email", email);
        else          localStorage.removeItem("caroldo_remember_email");
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
    if (!email) { toast.info("Digite seu e-mail corporativo no campo acima primeiro."); return; }
    toast.promise(
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?reset=true`,
      }),
      {
        loading: "Enviando e-mail de recuperação...",
        success: "Link de recuperação enviado!",
        error:   "Não foi possível enviar o e-mail de recuperação.",
      },
    );
  }

  return (
    <>
      {/* Montserrat — igual ao pacote */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap"
        rel="stylesheet"
      />

      <main>
        {/* ══════════════════════════════════════════════════
            DESKTOP — palco 1672×941 com arte-base rasterizada
            ══════════════════════════════════════════════════ */}
        <section className="cl-desktop-scene" aria-label="Acesso corporativo Caroldo">
          <div className="cl-desktop-stage" id="cl-desktop-stage">
            {/* Arte-base: imagem de referência 3D do pacote */}
            <img
              className="cl-reference-art"
              src="/assets/referencia-desktop.png"
              alt=""
              aria-hidden="true"
            />

            {/* Texto acessível sem duplicar visualmente */}
            <div className="cl-sr-only">
              <h1>Gestão que impulsiona resultados.</h1>
              <p>Sistema integrado de gestão da Caroldo.</p>
              <p>O senhor é meu pastor, nada me faltará. Salmo 23.</p>
            </div>

            {/* Card interativo posicionado pixel-perfect */}
            <div className="cl-login-card cl-desktop-card">
              <h2 className="cl-card-heading">
                {/* Triple-click no heading abre QuickAccessDialog */}
                <span onClick={handleTripleClick} style={{ cursor: "default" }}>
                  Comece seu dia com
                </span>
                <strong>fé, trabalho e compromisso.</strong>
              </h2>
              <LoginForm
                emailId="desktop-email"
                passwordId="desktop-password"
                busy={busy}
                onSubmit={handleLogin}
                onForgot={handleForgot}
              />
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════
            MOBILE — reflow vertical com anéis orgânicos
            ══════════════════════════════════════════════════ */}
        <section className="cl-mobile-scene" aria-label="Acesso Caroldo no celular">
          <div className="cl-mobile-ribbon" aria-hidden="true" />
          <div className="cl-mobile-content">
            <header
              className="cl-mobile-brand"
              onClick={handleTripleClick}
              title="Portal Caroldo — clique 3× para acesso rápido"
              style={{ cursor: "default" }}
            >
              <img
                src="/assets/logo-caroldo.png"
                alt="Caroldo Prestação de Serviços Ltda, Triunfo - RS"
              />
              <p className="cl-verse">"O senhor é meu pastor, nada me faltará."</p>
              <p className="cl-verse-source">SALMO 23</p>
            </header>
            <div className="cl-mobile-copy">
              <h1>
                Gestão que <em>impulsiona</em> resultados<span className="cl-period">.</span>
              </h1>
              <p>Sistema integrado de gestão da Caroldo.</p>
            </div>
            <div className="cl-login-card cl-mobile-card">
              <h2 className="cl-card-heading">
                <span>Comece seu dia com</span>
                <strong>fé, trabalho e compromisso.</strong>
              </h2>
              <LoginForm
                emailId="mobile-email"
                passwordId="mobile-password"
                busy={busy}
                onSubmit={handleLogin}
                onForgot={handleForgot}
              />
            </div>
          </div>
        </section>
      </main>

      <QuickAccessDialog open={quickOpen} onOpenChange={setQuickOpen} />

      {/* ══════════════════════════════════════════════════
          CSS — espelho fiel do styles.css do pacote
          (prefixado com cl- para não vazar ao app)
          ══════════════════════════════════════════════════ */}
      <style>{`
        /* Reset mínimo */
        *, *::before, *::after { box-sizing: border-box; }

        /* Variáveis */
        :root {
          --cl-orange:     #ff6a00;
          --cl-orange-hot: #ff4d0a;
          --cl-white:      #fff;
          --cl-soft:       #b8b8bd;
          --cl-field:      #1c1c1e;
        }

        /* Tipografia base */
        body { font-family: Montserrat, Arial, sans-serif; background: #09090a; color: #fff; -webkit-font-smoothing: antialiased; }
        button, input { font: inherit; }
        button { cursor: pointer; }

        /* Screen-reader only */
        .cl-sr-only {
          position: absolute; width: 1px; height: 1px; padding: 0;
          margin: -1px; overflow: hidden; clip: rect(0,0,0,0);
          white-space: nowrap; border: 0;
        }

        /* ── DESKTOP SCENE ── */
        .cl-desktop-scene {
          position: fixed; inset: 0;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden; background: #070708;
        }
        .cl-desktop-stage {
          width: 1672px; height: 941px;
          position: relative; flex: 0 0 auto;
          transform: scale(var(--scene-scale, 1));
          transform-origin: center center;
        }
        .cl-reference-art {
          position: absolute; width: 1672px; height: 941px;
          inset: 0; object-fit: cover;
          pointer-events: none; user-select: none;
        }

        /* ── CARD ── */
        .cl-login-card { color: #fff; isolation: isolate; }
        .cl-desktop-card {
          position: absolute; left: 949px; top: 186px;
          width: 595px; min-height: 578px;
          padding: 50px 60px 43px;
          border-radius: 31px; border: 1.5px solid #ff9b61;
          background:
            radial-gradient(ellipse at 96% 0%, rgba(116,47,10,.17), transparent 55%),
            linear-gradient(130deg, #161617 0%, #0b0d0e 54%, #21110b 100%);
          box-shadow: 0 8px 28px #0008, inset 0 0 20px #ff6b0014, 0 0 40px #ff720013;
          overflow: visible;
        }
        .cl-desktop-card::before {
          content: "";
          position: absolute; inset: 0; border-radius: inherit;
          pointer-events: none;
          background: linear-gradient(155deg, rgba(255,117,37,.08), transparent 41%, transparent 72%, rgba(240,79,0,.16));
          z-index: -1;
        }

        /* ── HEADING ── */
        .cl-card-heading {
          font-weight: 800; letter-spacing: -1.5px; line-height: 1.16;
          margin: 0 0 38px; font-size: 35px;
        }
        .cl-card-heading span,
        .cl-card-heading strong { display: block; }
        .cl-card-heading span   { color: white; }
        .cl-card-heading strong {
          color: #ff671a; font-weight: 800;
          white-space: nowrap; font-size: 34px; letter-spacing: -1.7px;
        }

        /* ── FORM ── */
        .cl-login-form { display: block; }
        .cl-field-group { position: relative; margin-bottom: 26px; }
        .cl-field-group > label { display: block; font-size: 16px; font-weight: 600; margin: 0 0 10px; line-height: 1.25; }

        .cl-field-shell {
          display: flex; align-items: center;
          height: 60px; border-radius: 14px;
          border: 1px solid #6c6261;
          background: linear-gradient(100deg, #232124ed, #222224e3);
          transition: border-color .18s, box-shadow .18s;
        }
        .cl-field-shell:focus-within {
          border-color: #ff8d43;
          box-shadow: 0 0 0 3px #ff760026;
        }

        .cl-field-icon {
          width: 25px; height: 25px; flex: 0 0 25px; margin-left: 19px;
          fill: none; stroke: #fff; stroke-width: 1.7;
          stroke-linecap: round; stroke-linejoin: round;
        }
        .cl-field-shell input {
          background: transparent; color: #fff; border: 0; outline: 0;
          min-width: 0; flex: 1;
          padding: 0 14px 0 18px; height: 100%;
          font-size: 15px; letter-spacing: -.4px;
        }
        .cl-field-shell input::placeholder { color: #b5b4b8; opacity: 1; }
        .cl-field-shell input:-webkit-autofill {
          -webkit-text-fill-color: #fff;
          transition: background-color 999999s;
        }

        /* Toggle de senha */
        .cl-reveal {
          width: 52px; height: 100%;
          background: transparent; border: 0; color: white;
          display: flex; align-items: center; justify-content: center;
          border-radius: 13px;
        }
        .cl-eye-svg {
          width: 23px; height: 23px;
          fill: none; stroke: currentColor; stroke-width: 1.6;
          stroke-linecap: round; stroke-linejoin: round;
        }
        .cl-reveal:hover { color: #ff8a40; }
        :focus-visible { outline: 2px solid #ffae6d; outline-offset: 3px; }

        /* Erros de campo */
        .cl-field-error {
          position: absolute; left: 4px; top: 100%;
          margin: 3px 0 0; color: #ffae8c; font-size: 11px; line-height: 1.2; min-height: 0;
        }
        .cl-has-error { margin-bottom: 32px; }
        .cl-password-group { margin-bottom: 21px; }

        /* Actions row */
        .cl-actions-row {
          display: flex; justify-content: space-between; align-items: center;
          gap: 12px; margin-bottom: 28px; font-size: 14px; letter-spacing: -.4px;
        }
        .cl-remember {
          display: flex; align-items: center; gap: 12px;
          cursor: pointer; white-space: nowrap;
        }
        .cl-remember input {
          appearance: none; margin: 0;
          width: 23px; height: 23px; border-radius: 4px;
          border: 1px solid #8a7471; background: #141416;
          display: grid; place-content: center;
          cursor: pointer; flex: 0 0 auto;
        }
        .cl-remember input:checked::after {
          content: "";
          width: 11px; height: 6px;
          border: solid #ff6b00; border-width: 0 0 2px 2px;
          transform: rotate(-45deg) translate(0, -2px);
        }
        .cl-forgot {
          background: none; border: none; padding: 0;
          color: #cbcad0; text-decoration: none;
          white-space: nowrap; font-size: 13px;
          transition: color .15s;
        }
        .cl-forgot:hover, .cl-forgot:focus-visible {
          color: white; text-decoration: underline;
        }

        /* CTA */
        .cl-submit-button {
          height: 69px; width: 100%;
          background: linear-gradient(100deg, #ff8b00 0%, #ff5700 57%, #ff4e09 100%);
          border: 0; border-radius: 26px;
          color: white; font-size: 19px; font-weight: 700; letter-spacing: -.7px;
          display: flex; align-items: center; justify-content: center; gap: 15px;
          box-shadow: 0 10px 27px #fa560052, inset 0 1px 0 #ffb26d60;
          transition: filter .2s, transform .2s;
        }
        .cl-submit-button:hover  { filter: brightness(1.09); transform: translateY(-1px); }
        .cl-submit-button:active { transform: translateY(0); }
        .cl-submit-button:disabled { opacity: .72; cursor: wait; }
        .cl-cta-arrow {
          width: 22px; height: 22px;
          fill: none; stroke: currentColor; stroke-width: 1.8;
          stroke-linecap: round; stroke-linejoin: round;
        }

        /* ── MOBILE SCENE ── */
        .cl-mobile-scene { display: none; }

        @media (max-width: 900px) {
          .cl-desktop-scene { display: none; }
          .cl-mobile-scene {
            position: relative; display: block;
            overflow: hidden; min-height: 100svh;
            background:
              radial-gradient(ellipse at 105% 10%, #4d230f 0%, transparent 47%),
              radial-gradient(ellipse at 0% 100%,  #331305 0%, transparent 45%),
              #0a0a0d;
          }
          .cl-mobile-scene::before {
            content: "";
            position: absolute; top: -220px; right: -310px;
            width: 670px; height: 670px;
            border: 68px solid #f76a0a; border-radius: 50%;
            transform: rotate(35deg) skew(-12deg);
            box-shadow: inset 15px -12px 22px #9c3005, 0 0 70px #ff6e0025;
            opacity: .64; pointer-events: none;
          }
          .cl-mobile-scene::after {
            content: "";
            position: absolute; bottom: -420px; left: -370px;
            width: 690px; height: 690px;
            border: 63px solid #453e3b; border-radius: 50%;
            opacity: .3; pointer-events: none;
          }
          .cl-mobile-ribbon {
            position: absolute; top: 340px; right: -250px;
            width: 480px; height: 480px;
            border: 50px solid #301d19;
            border-top-color: #ea5a0a; border-left-color: #f77f18;
            border-radius: 50%; transform: rotate(30deg);
            filter: blur(2px); opacity: .32;
          }
          .cl-mobile-content {
            position: relative; z-index: 1;
            display: flex; flex-direction: column; align-items: center;
            max-width: 480px; margin: auto;
            padding: 32px 20px max(24px, env(safe-area-inset-bottom));
          }
          .cl-mobile-brand { text-align: center; }
          .cl-mobile-brand img {
            display: block; width: 144px; height: 144px;
            object-fit: contain; margin: 0 auto 8px;
            filter: drop-shadow(0 5px 14px #0009);
          }
          .cl-verse        { font-size: 12px; font-weight: 700; margin: 0; line-height: 1.5; }
          .cl-verse-source { font-size: 11px; color: #a8a5a8; margin: 5px 0 0; letter-spacing: .7px; }

          .cl-mobile-copy { text-align: center; margin: 26px 0 23px; }
          .cl-mobile-copy h1 {
            font-size: clamp(29px, 7.9vw, 45px);
            line-height: 1.06; letter-spacing: -1.6px; font-weight: 900; margin: 0 0 13px;
          }
          .cl-mobile-copy h1 em    { display: block; color: #ff6a00; font-style: normal; }
          .cl-mobile-copy h1 .cl-period { color: #ff6a00; }
          .cl-mobile-copy p { font-size: 13px; line-height: 1.5; color: #c5c1c5; margin: 0; }

          .cl-mobile-card {
            width: 100%; border-radius: 23px; padding: 28px 23px 25px;
            border: 1px solid #ff995d;
            background: linear-gradient(139deg, #1b1819ed, #0b0c0eef 64%, #261309ef);
            box-shadow: 0 15px 45px #0008, inset 0 0 24px #ff6a0010, 0 0 30px #ff6a0016;
            backdrop-filter: blur(18px);
          }
          .cl-card-heading {
            font-size: clamp(21px, 5.5vw, 28px); line-height: 1.18;
            letter-spacing: -.8px; margin-bottom: 26px;
          }
          .cl-card-heading strong {
            font-size: clamp(20px, 5vw, 26px); letter-spacing: -.7px;
            white-space: normal; margin-top: 3px;
          }
          .cl-field-group   { margin-bottom: 23px; }
          .cl-field-group > label { font-size: 13px; margin-bottom: 8px; }
          .cl-field-shell   { height: 54px; border-radius: 12px; }
          .cl-field-icon    { width: 21px; height: 21px; flex-basis: 21px; margin-left: 15px; }
          .cl-field-shell input { padding-left: 12px; font-size: 13px; }
          .cl-password-group { margin-bottom: 18px; }
          .cl-actions-row   { font-size: 11px; gap: 8px; margin-bottom: 24px; }
          .cl-forgot        { font-size: 11px; }
          .cl-remember      { gap: 7px; }
          .cl-remember input { width: 19px; height: 19px; }
          .cl-submit-button { height: 57px; border-radius: 18px; font-size: 14px; }
          .cl-cta-arrow     { width: 18px; height: 18px; }
        }

        @media (max-width: 350px) {
          .cl-mobile-content { padding-inline: 12px; }
          .cl-mobile-card    { padding-inline: 16px; }
          .cl-actions-row    { flex-wrap: wrap; }
          .cl-forgot         { margin-left: auto; }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { transition: none !important; animation: none !important; }
        }
      `}</style>
    </>
  );
}
