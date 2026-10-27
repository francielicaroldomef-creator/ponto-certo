import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/hooks/use-auth";

export const MASTER_PASSWORD = "francieliadmin";
const SESSION_STORAGE_KEY = "ps_quick_access_session";
const CREDENTIALS_LOCAL_KEY = "ps_quick_access_credentials";

export interface QuickAccessCredential {
  id: string;
  name: string;
  access_key: string;
  role: Role;
  allowed_contracts: string[];
  allowed_modules: string[];
  active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface QuickAccessSession {
  id: string;
  name: string;
  role: Role;
  allowedContracts: string[];
  allowedModules: string[];
  isMasterAdmin: boolean;
  timestamp: number;
}

export const AVAILABLE_MODULES: { path: string; label: string; group: string }[] = [
  { path: "/painel", label: "Painel geral", group: "Operação" },
  { path: "/conferencia", label: "Conferência diária", group: "Operação" },
  { path: "/coberturas", label: "Coberturas", group: "Operação" },
  { path: "/efetivo", label: "Conferência do efetivo", group: "Operação" },
  { path: "/documentos", label: "Documentos de ponto", group: "Ponto" },
  { path: "/divergencias", label: "Divergências", group: "Ponto" },
  { path: "/contratos", label: "Contratos", group: "Cadastros" },
  { path: "/postos", label: "Postos", group: "Cadastros" },
  { path: "/funcionarios", label: "Funcionários", group: "Cadastros" },
  { path: "/escalas", label: "Escalas", group: "Cadastros" },
  { path: "/diaristas", label: "Diaristas", group: "Cadastros" },
  { path: "/relatorios", label: "Relatórios", group: "Gestão" },
  { path: "/fechamentos", label: "Fechamentos", group: "Gestão" },
  { path: "/usuarios", label: "Usuários e configurações", group: "Gestão" },
];

let memoryStorage: Record<string, string> = {};

function getStorageItem(key: string): string | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem(key);
    }
  } catch {
    // fallback
  }
  return memoryStorage[key] || null;
}

function setStorageItem(key: string, value: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, value);
    }
  } catch {
    // fallback
  }
  memoryStorage[key] = value;
}

function removeStorageItem(key: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(key);
    }
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(key);
    }
  } catch {
    // fallback
  }
  delete memoryStorage[key];
}

/**
 * Lê a sessão de acesso rápido ativa no localStorage.
 */
export function getQuickAccessSession(): QuickAccessSession | null {
  try {
    const raw = getStorageItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session: QuickAccessSession = JSON.parse(raw);
    return session;
  } catch {
    return null;
  }
}

/**
 * Grava a sessão de acesso rápido.
 */
export function setQuickAccessSession(session: QuickAccessSession): void {
  try {
    setStorageItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

/**
 * Limpa a sessão de acesso rápido ativa.
 */
export function clearQuickAccessSession(): void {
  try {
    removeStorageItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Lê credenciais locais armazenadas como fallback/cache.
 */
function getLocalCredentials(): QuickAccessCredential[] {
  try {
    const raw = getStorageItem(CREDENTIALS_LOCAL_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Salva credenciais locais no localStorage.
 */
function setLocalCredentials(creds: QuickAccessCredential[]): void {
  try {
    setStorageItem(CREDENTIALS_LOCAL_KEY, JSON.stringify(creds));
  } catch {
    // ignore
  }
}

/**
 * Busca todas as credenciais cadastradas (tenta Supabase primeiro, faz fallback para localStorage).
 */
export async function getQuickCredentials(): Promise<QuickAccessCredential[]> {
  try {
    const { data, error } = await supabase
      .from("quick_access_credentials" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      setLocalCredentials(data as unknown as QuickAccessCredential[]);
      return data as unknown as QuickAccessCredential[];
    }
  } catch {
    // Fallback para armazenamento local
  }
  return getLocalCredentials();
}

/**
 * Salva ou atualiza uma credencial de acesso rápido.
 */
export async function saveQuickCredential(
  cred: Omit<QuickAccessCredential, "id" | "created_at"> & { id?: string }
): Promise<QuickAccessCredential> {
  const now = new Date().toISOString();
  const id = cred.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `qa_${Date.now()}`);

  const item: QuickAccessCredential = {
    id,
    name: cred.name.trim(),
    access_key: cred.access_key.trim(),
    role: cred.role,
    allowed_contracts: cred.allowed_contracts || [],
    allowed_modules: cred.allowed_modules || [],
    active: cred.active !== false,
    created_at: now,
    updated_at: now,
  };

  // Tenta persistir no Supabase se a tabela existir
  try {
    const { error } = await supabase
      .from("quick_access_credentials" as any)
      .upsert(item as any);

    if (error) {
      console.warn("[QuickAccess] Supabase upsert failed, using localStorage fallback:", error.message);
    }
  } catch (e) {
    console.warn("[QuickAccess] Supabase unavailable, using localStorage fallback:", e);
  }

  // Atualiza cache local
  const current = getLocalCredentials();
  const idx = current.findIndex((c) => c.id === id);
  if (idx >= 0) {
    current[idx] = { ...current[idx], ...item };
  } else {
    current.unshift(item);
  }
  setLocalCredentials(current);

  return item;
}

/**
 * Remove uma credencial de acesso rápido.
 */
export async function deleteQuickCredential(id: string): Promise<void> {
  try {
    await supabase.from("quick_access_credentials" as any).delete().eq("id", id);
  } catch {
    // ignore
  }

  const current = getLocalCredentials().filter((c) => c.id !== id);
  setLocalCredentials(current);
}

/**
 * Valida a senha digitada e autentica:
 * - Se for 'francieliadmin': concede perfil Super Administrador ('admin') com todos os módulos.
 * - Se corresponder a uma credencial individual ativa: concede perfil com contratos e telas filtrados.
 */
export async function authenticateQuickAccess(
  passwordInput: string
): Promise<{ success: boolean; session?: QuickAccessSession; error?: string }> {
  const pwd = passwordInput.trim();
  if (!pwd) {
    return { success: false, error: "Informe a senha de acesso." };
  }

  // 1. Verificação Master Francieli
  if (pwd === MASTER_PASSWORD) {
    const session: QuickAccessSession = {
      id: "francieli-admin-master",
      name: "Francieli (Administradora)",
      role: "admin",
      allowedContracts: [], // Todos os contratos
      allowedModules: AVAILABLE_MODULES.map((m) => m.path), // Todos os módulos
      isMasterAdmin: true,
      timestamp: Date.now(),
    };
    setQuickAccessSession(session);
    return { success: true, session };
  }

  // 2. Verificação de credenciais individuais
  const credentials = await getQuickCredentials();
  const matched = credentials.find((c) => c.active && c.access_key === pwd);

  if (matched) {
    const session: QuickAccessSession = {
      id: matched.id,
      name: matched.name,
      role: matched.role,
      allowedContracts: matched.allowed_contracts,
      allowedModules: matched.allowed_modules.length > 0 ? matched.allowed_modules : ["/painel", "/conferencia"],
      isMasterAdmin: false,
      timestamp: Date.now(),
    };
    setQuickAccessSession(session);
    return { success: true, session };
  }

  return { success: false, error: "Senha incorreta ou acesso inativo." };
}
