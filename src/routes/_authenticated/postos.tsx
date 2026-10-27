import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useContracts } from "@/hooks/use-auth";
import { upsertContractPostsBatch, type BatchPostInput } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Building2,
  MapPin,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  Copy,
  Table2,
  Layers,
  Sparkles,
  Search,
  Check,
  AlertCircle,
  Briefcase,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/postos")({
  head: () => ({ meta: [{ title: "Postos de Trabalho — Portal do Supervisor" }] }),
  component: PostosHierarquicos,
});

export interface PostGridItem {
  tempId: string;
  id?: string;
  code: string;
  workplace: string;
  role_name: string;
  required_qty: number;
  active: boolean;
}

export interface CityGroupItem {
  id: string;
  name: string;
  targetQty: number;
  posts: PostGridItem[];
}

const COMMON_ROLES = [
  "Servente de Limpeza",
  "Auxiliar de Limpeza",
  "Porteiro",
  "Vigilante",
  "Copeira",
  "Zelador",
  "Jardineiro",
  "Recepcionista",
];

function generateCode(cityName: string, index: number, existingCodes: Set<string>): string {
  const prefix = cityName.trim()
    ? cityName
        .trim()
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 3)
        .toUpperCase()
    : "P";

  let codeCandidate = `${prefix}-${String(index + 1).padStart(2, "0")}`;
  if (!existingCodes.has(codeCandidate)) {
    return codeCandidate;
  }

  // Fallback to P01, P02...
  let counter = index + 1;
  while (existingCodes.has(`P${String(counter).padStart(2, "0")}`)) {
    counter++;
  }
  return `P${String(counter).padStart(2, "0")}`;
}

export function PostosHierarquicos() {
  const queryClient = useQueryClient();
  const { data: contracts, isLoading: isLoadingContracts } = useContracts();

  const [selectedContractId, setSelectedContractId] = useState<string>("");
  const [cities, setCities] = useState<CityGroupItem[]>([]);
  const [deletedPostIds, setDeletedPostIds] = useState<string[]>([]);
  const [activeCityTab, setActiveCityTab] = useState<string>("all");
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Auto-select first contract if none selected
  useEffect(() => {
    if (!selectedContractId && contracts && contracts.length > 0) {
      setSelectedContractId(contracts[0].id);
    }
  }, [contracts, selectedContractId]);

  const selectedContract = useMemo(() => {
    return (contracts ?? []).find((c) => c.id === selectedContractId);
  }, [contracts, selectedContractId]);

  // Load posts for the selected contract from Supabase
  const { data: rawPosts, isLoading: isLoadingPosts, refetch: refetchPosts } = useQuery({
    queryKey: ["contract-posts", selectedContractId],
    queryFn: async () => {
      if (!selectedContractId) return [];
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("contract_id", selectedContractId)
        .order("code");
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(selectedContractId),
  });

  // Reconstruct hierarchical state from loaded posts
  useEffect(() => {
    if (!selectedContractId) return;

    if (rawPosts && rawPosts.length > 0) {
      // Group loaded posts by city
      const cityMap = new Map<string, PostGridItem[]>();

      for (const p of rawPosts) {
        const cityName = (p.city || selectedContract?.city || "Cidade Principal").trim();
        const item: PostGridItem = {
          tempId: p.id,
          id: p.id,
          code: p.code || "",
          workplace: p.workplace || "",
          role_name: p.role_name || "Servente de Limpeza",
          required_qty: p.required_qty && p.required_qty > 0 ? p.required_qty : 1,
          active: p.active !== false,
        };
        const currentList = cityMap.get(cityName) ?? [];
        currentList.push(item);
        cityMap.set(cityName, currentList);
      }

      const parsedCities: CityGroupItem[] = [];
      let index = 1;
      for (const [cityName, cityPosts] of cityMap.entries()) {
        parsedCities.push({
          id: `city-${index++}`,
          name: cityName,
          targetQty: cityPosts.length,
          posts: cityPosts,
        });
      }

      setCities(parsedCities);
      setDeletedPostIds([]);
      setHasChanges(false);
      setActiveCityTab("all");
    } else if (rawPosts && rawPosts.length === 0) {
      // Default initial state: 1 city, 1 post
      const initialCityName = selectedContract?.city || "Cidade Principal";
      const initialPost: PostGridItem = {
        tempId: `temp-${Date.now()}-1`,
        code: "P01",
        workplace: "",
        role_name: "Servente de Limpeza",
        required_qty: 1,
        active: true,
      };

      setCities([
        {
          id: `city-1`,
          name: initialCityName,
          targetQty: 1,
          posts: [initialPost],
        },
      ]);
      setDeletedPostIds([]);
      setHasChanges(false);
      setActiveCityTab("all");
    }
  }, [rawPosts, selectedContractId, selectedContract?.city]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalCities = cities.length;
    let totalPosts = 0;
    let totalRequiredStaff = 0;
    let activePostsCount = 0;

    for (const c of cities) {
      totalPosts += c.posts.length;
      for (const p of c.posts) {
        if (p.active) {
          activePostsCount++;
          totalRequiredStaff += p.required_qty || 1;
        }
      }
    }

    return {
      totalCities,
      totalPosts,
      totalRequiredStaff,
      activePostsCount,
    };
  }, [cities]);

  // --- Handlers for Cidades (Card 2) ---

  const handleCityCountChange = useCallback((newCountRaw: number) => {
    const newCount = Math.max(1, Math.min(newCountRaw || 1, 50));
    setCities((prev) => {
      if (newCount === prev.length) return prev;

      if (newCount > prev.length) {
        const added: CityGroupItem[] = [];
        const existingCodes = new Set(prev.flatMap((c) => c.posts.map((p) => p.code)));

        for (let i = prev.length; i < newCount; i++) {
          const defaultName = `Cidade ${i + 1}`;
          const code = generateCode(defaultName, 0, existingCodes);
          existingCodes.add(code);

          added.push({
            id: `city-${Date.now()}-${i}`,
            name: defaultName,
            targetQty: 1,
            posts: [
              {
                tempId: `temp-${Date.now()}-${i}`,
                code,
                workplace: "",
                role_name: "Servente de Limpeza",
                required_qty: 1,
                active: true,
              },
            ],
          });
        }
        return [...prev, ...added];
      } else {
        // Decreasing count: track any deleted DB posts
        const removed = prev.slice(newCount);
        const removedIds = removed
          .flatMap((c) => c.posts)
          .map((p) => p.id)
          .filter((id): id is string => Boolean(id));

        if (removedIds.length > 0) {
          setDeletedPostIds((old) => [...old, ...removedIds]);
        }
        return prev.slice(0, newCount);
      }
    });
    setHasChanges(true);
  }, []);

  const handleAddCity = useCallback(() => {
    setCities((prev) => {
      const idx = prev.length + 1;
      const defaultName = `Cidade ${idx}`;
      const existingCodes = new Set(prev.flatMap((c) => c.posts.map((p) => p.code)));
      const code = generateCode(defaultName, 0, existingCodes);

      return [
        ...prev,
        {
          id: `city-${Date.now()}-${idx}`,
          name: defaultName,
          targetQty: 1,
          posts: [
            {
              tempId: `temp-${Date.now()}-${idx}`,
              code,
              workplace: "",
              role_name: "Servente de Limpeza",
              required_qty: 1,
              active: true,
            },
          ],
        },
      ];
    });
    setHasChanges(true);
  }, []);

  const handleUpdateCityName = useCallback((cityId: string, newName: string) => {
    setCities((prev) =>
      prev.map((c) => (c.id === cityId ? { ...c, name: newName } : c))
    );
    setHasChanges(true);
  }, []);

  const handleUpdateCityTargetQty = useCallback((cityId: string, targetQtyRaw: number) => {
    const targetQty = Math.max(1, Math.min(targetQtyRaw || 1, 100));

    setCities((prev) =>
      prev.map((c) => {
        if (c.id !== cityId) return c;

        const currentPosts = [...c.posts];
        if (targetQty > currentPosts.length) {
          const allCodes = new Set(prev.flatMap((x) => x.posts.map((p) => p.code)));
          for (let i = currentPosts.length; i < targetQty; i++) {
            const code = generateCode(c.name, i, allCodes);
            allCodes.add(code);
            currentPosts.push({
              tempId: `temp-${Date.now()}-${i}`,
              code,
              workplace: "",
              role_name: "Servente de Limpeza",
              required_qty: 1,
              active: true,
            });
          }
        }
        return {
          ...c,
          targetQty,
          posts: currentPosts,
        };
      })
    );
    setHasChanges(true);
  }, []);

  const handleRemoveCity = useCallback((cityId: string) => {
    setCities((prev) => {
      if (prev.length <= 1) {
        toast.info("O contrato deve possuir pelo menos 1 cidade.");
        return prev;
      }
      const cityToRemove = prev.find((c) => c.id === cityId);
      if (cityToRemove) {
        const removedIds = cityToRemove.posts
          .map((p) => p.id)
          .filter((id): id is string => Boolean(id));
        if (removedIds.length > 0) {
          setDeletedPostIds((old) => [...old, ...removedIds]);
        }
      }
      return prev.filter((c) => c.id !== cityId);
    });
    setHasChanges(true);
  }, []);

  // --- Handlers for Postos (Card 3 - Grade Estilo Excel) ---

  const handleUpdatePost = useCallback(
    (cityId: string, tempId: string, field: keyof PostGridItem, value: any) => {
      setCities((prev) =>
        prev.map((c) => {
          if (c.id !== cityId) return c;
          return {
            ...c,
            posts: c.posts.map((p) => (p.tempId === tempId ? { ...p, [field]: value } : p)),
          };
        })
      );
      setHasChanges(true);
    },
    []
  );

  const handleAddPostToCity = useCallback((cityId: string) => {
    setCities((prev) =>
      prev.map((c) => {
        if (c.id !== cityId) return c;
        const allCodes = new Set(prev.flatMap((x) => x.posts.map((p) => p.code)));
        const newCode = generateCode(c.name, c.posts.length, allCodes);

        const newPost: PostGridItem = {
          tempId: `temp-${Date.now()}-${c.posts.length}`,
          code: newCode,
          workplace: "",
          role_name: "Servente de Limpeza",
          required_qty: 1,
          active: true,
        };

        return {
          ...c,
          targetQty: Math.max(c.targetQty, c.posts.length + 1),
          posts: [...c.posts, newPost],
        };
      })
    );
    setHasChanges(true);
  }, []);

  const handleAddMultiplePostsToCity = useCallback((cityId: string, count: number = 5) => {
    setCities((prev) =>
      prev.map((c) => {
        if (c.id !== cityId) return c;
        const allCodes = new Set(prev.flatMap((x) => x.posts.map((p) => p.code)));
        const newPosts: PostGridItem[] = [];

        for (let i = 0; i < count; i++) {
          const newCode = generateCode(c.name, c.posts.length + i, allCodes);
          allCodes.add(newCode);
          newPosts.push({
            tempId: `temp-${Date.now()}-${c.posts.length + i}`,
            code: newCode,
            workplace: "",
            role_name: "Servente de Limpeza",
            required_qty: 1,
            active: true,
          });
        }

        return {
          ...c,
          targetQty: c.posts.length + count,
          posts: [...c.posts, ...newPosts],
        };
      })
    );
    setHasChanges(true);
  }, []);

  const handleDuplicatePost = useCallback((cityId: string, tempId: string) => {
    setCities((prev) =>
      prev.map((c) => {
        if (c.id !== cityId) return c;
        const target = c.posts.find((p) => p.tempId === tempId);
        if (!target) return c;

        const allCodes = new Set(prev.flatMap((x) => x.posts.map((p) => p.code)));
        const newCode = generateCode(c.name, c.posts.length, allCodes);

        const cloned: PostGridItem = {
          tempId: `temp-${Date.now()}`,
          code: newCode,
          workplace: target.workplace ? `${target.workplace} (Cópia)` : "",
          role_name: target.role_name,
          required_qty: target.required_qty,
          active: true,
        };

        return {
          ...c,
          targetQty: Math.max(c.targetQty, c.posts.length + 1),
          posts: [...c.posts, cloned],
        };
      })
    );
    setHasChanges(true);
  }, []);

  const handleRemovePost = useCallback((cityId: string, tempId: string) => {
    setCities((prev) =>
      prev.map((c) => {
        if (c.id !== cityId) return c;
        if (c.posts.length <= 1) {
          toast.info("A cidade deve ter pelo menos 1 posto de trabalho.");
          return c;
        }

        const postToRemove = c.posts.find((p) => p.tempId === tempId);
        if (postToRemove?.id) {
          setDeletedPostIds((old) => [...old, postToRemove.id!]);
        }

        return {
          ...c,
          targetQty: Math.max(1, c.posts.length - 1),
          posts: c.posts.filter((p) => p.tempId !== tempId),
        };
      })
    );
    setHasChanges(true);
  }, []);

  // Enter key handler in Excel grid: move down or add new row
  const handleKeyDownGrid = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, cityId: string, postIndex: number, postsCount: number) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (postIndex === postsCount - 1) {
          handleAddPostToCity(cityId);
        } else {
          // Focus the next row's input with the same column if possible
          const nextInput = document.querySelector<HTMLInputElement>(
            `input[data-city-id="${cityId}"][data-row-index="${postIndex + 1}"]`
          );
          if (nextInput) nextInput.focus();
        }
      }
    },
    [handleAddPostToCity]
  );

  // --- Batch Save (Passo 5) ---
  const handleSaveAll = async () => {
    if (!selectedContractId) {
      toast.error("Selecione um contrato antes de salvar.");
      return;
    }

    // Validate that cities have names
    for (let i = 0; i < cities.length; i++) {
      if (!cities[i].name.trim()) {
        toast.error(`Informe o nome da cidade #${i + 1}.`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const postsToUpsert: BatchPostInput[] = [];

      for (const city of cities) {
        const cityName = city.name.trim();

        for (let idx = 0; idx < city.posts.length; idx++) {
          const p = city.posts[idx];
          const cleanCode = p.code.trim() || `P${String(idx + 1).padStart(2, "0")}`;
          const cleanWorkplace = p.workplace.trim() || `Posto ${cleanCode}`;
          const cleanRole = p.role_name.trim() || "Servente de Limpeza";
          const qty = p.required_qty && p.required_qty > 0 ? Number(p.required_qty) : 1;

          postsToUpsert.push({
            ...(p.id ? { id: p.id } : {}),
            contract_id: selectedContractId,
            code: cleanCode,
            workplace: cleanWorkplace,
            city: cityName,
            role_name: cleanRole,
            required_qty: qty,
            active: p.active,
          });
        }
      }

      // Upsert batch in database without hours
      const res = await upsertContractPostsBatch(
        selectedContractId,
        postsToUpsert,
        deletedPostIds
      );

      // Sincronizar cidade principal no contrato se ainda não preenchida
      if (cities[0]?.name && (!selectedContract?.city || selectedContract.city === "Não informada")) {
        await supabase
          .from("contracts")
          .update({ city: cities[0].name.trim() })
          .eq("id", selectedContractId);
      }

      // Invalidate queries so all other screens update instantly
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["contract-posts", selectedContractId] }),
        queryClient.invalidateQueries({ queryKey: ["posts"] }),
        queryClient.invalidateQueries({ queryKey: ["contracts"] }),
        queryClient.invalidateQueries({ queryKey: ["period"] }),
      ]);

      toast.success(`✅ ${res.count} postos de trabalho gravados com sucesso!`);
      setHasChanges(false);
      setDeletedPostIds([]);
      await refetchPosts();
    } catch (err: any) {
      console.error("[Postos] Erro ao salvar postos em lote:", err);
      toast.error(`Falha ao salvar: ${err.message || "Erro desconhecido"}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-28">
      {/* Top Banner / Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Table2 className="h-6 w-6 text-primary" />
            Postos de Trabalho
          </h1>
          <p className="text-sm text-muted-foreground">
            Fluxo operacional guiado por contrato e cidades com edição rápida em lote estilo planilha (Excel).
          </p>
        </div>

        {/* Global Stats Overview */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 font-mono text-xs flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-semibold text-foreground">{stats.totalCities}</span> Cidades
          </Badge>
          <Badge variant="outline" className="px-3 py-1 font-mono text-xs flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-semibold text-foreground">{stats.totalPosts}</span> Postos
          </Badge>
          <Badge variant="outline" className="px-3 py-1 font-mono text-xs flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-semibold text-foreground">{stats.totalRequiredStaff}</span> Vagas / Efetivo
          </Badge>
          {hasChanges && (
            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-300 px-3 py-1 text-xs animate-pulse">
              Alterações pendentes
            </Badge>
          )}
        </div>
      </div>

      {/* 🧭 CARD 1: Seleção do Contrato */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  1
                </span>
                Seleção do Contrato de Atuação
              </CardTitle>
              <CardDescription>
                Escolha o contrato para carregar e gerenciar a estrutura operacional de cidades e postos.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-end">
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs font-medium text-muted-foreground">
                Contrato (Nome Amigável em Destaque)
              </label>
              <Select
                value={selectedContractId}
                onValueChange={(val) => {
                  setSelectedContractId(val);
                }}
              >
                <SelectTrigger className="w-full bg-background font-medium text-left">
                  <SelectValue placeholder="Selecione o contrato..." />
                </SelectTrigger>
                <SelectContent>
                  {(contracts ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id} className="py-2">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">
                          {c.name ? c.name : c.code}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          Código: {c.code} {c.client ? `• Cliente: ${c.client}` : ""}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedContract && (
              <div className="rounded-lg border bg-muted/40 p-2.5 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-medium text-foreground">{selectedContract.client || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cidade Base:</span>
                  <span className="font-medium text-foreground">
                    {selectedContract.city || cities[0]?.name || "Não definida"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 🧭 CARD 2: Definição e Cadastro das Cidades de Atuação (Grade Excel) */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  2
                </span>
                Cidades Atendidas pelo Contrato (Grade Excel)
              </CardTitle>
              <CardDescription>
                Informe a quantidade de cidades e a previsão de postos para cada localidade.
              </CardDescription>
            </div>

            {/* Quick Count Control */}
            <div className="flex items-center gap-3 bg-muted/50 p-1.5 rounded-lg border">
              <label htmlFor="city-count-input" className="text-xs font-medium text-foreground whitespace-nowrap pl-2">
                Quantas cidades este contrato atende?
              </label>
              <Input
                id="city-count-input"
                type="number"
                min={1}
                max={50}
                className="w-20 h-8 text-center font-bold bg-background text-sm"
                value={cities.length}
                onChange={(e) => handleCityCountChange(parseInt(e.target.value, 10))}
              />
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleAddCity}
                className="h-8 gap-1.5 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar Cidade
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-background overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/60">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12 text-center text-xs font-mono font-bold">#</TableHead>
                  <TableHead className="text-xs font-bold">Nome da Cidade de Atuação</TableHead>
                  <TableHead className="w-64 text-center text-xs font-bold">
                    Qtd. de Postos Previstos nesta Cidade
                  </TableHead>
                  <TableHead className="w-48 text-center text-xs font-bold">Postos Configurados</TableHead>
                  <TableHead className="w-24 text-center text-xs font-bold">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cities.map((city, idx) => {
                  const configuredCount = city.posts.length;
                  const targetCount = city.targetQty;
                  const isMatched = configuredCount >= targetCount;

                  return (
                    <TableRow key={city.id} className="hover:bg-muted/20">
                      {/* # Index */}
                      <TableCell className="text-center font-mono text-xs font-medium text-muted-foreground">
                        {idx + 1}
                      </TableCell>

                      {/* Nome da Cidade */}
                      <TableCell>
                        <Input
                          value={city.name}
                          onChange={(e) => handleUpdateCityName(city.id, e.target.value)}
                          placeholder="Ex: Erechim, Triunfo, Florianópolis..."
                          className="h-9 font-medium text-sm border-transparent hover:border-input focus:border-ring transition-colors"
                        />
                      </TableCell>

                      {/* Postos Previstos */}
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            value={city.targetQty}
                            onChange={(e) =>
                              handleUpdateCityTargetQty(city.id, parseInt(e.target.value, 10))
                            }
                            className="w-24 h-9 text-center font-bold text-sm bg-muted/20 border-input"
                          />
                          <span className="text-xs text-muted-foreground">postos</span>
                        </div>
                      </TableCell>

                      {/* Status / Configurados */}
                      <TableCell className="text-center">
                        <Badge
                          variant={isMatched ? "secondary" : "outline"}
                          className={`font-mono text-xs ${
                            isMatched
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300"
                          }`}
                        >
                          {configuredCount} de {targetCount} linhas
                        </Badge>
                      </TableCell>

                      {/* Ações */}
                      <TableCell className="text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoveCity(city.id)}
                          title="Remover Cidade"
                          disabled={cities.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 🧭 CARD 3: Cadastro dos Postos de Trabalho por Cidade (Grade Estilo Excel) */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  3
                </span>
                Postos de Trabalho por Cidade (Grade Estilo Planilha)
              </CardTitle>
              <CardDescription>
                Edição rápida de locais e funções em grade contínua. Digite e navegue com <code>Tab</code> ou <code>Enter</code>.
              </CardDescription>
            </div>

            {/* City Selection Tabs (Excel Worksheets Style) */}
            <div className="flex flex-wrap items-center gap-1.5 bg-muted/60 p-1 rounded-lg border">
              <button
                type="button"
                onClick={() => setActiveCityTab("all")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  activeCityTab === "all"
                    ? "bg-background text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                🏢 Todas as Cidades ({stats.totalPosts})
              </button>

              {cities.map((city) => (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => setActiveCityTab(city.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                    activeCityTab === city.id
                      ? "bg-background text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <MapPin className="h-3 w-3 text-primary" />
                  <span>{city.name || "Sem nome"}</span>
                  <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-mono">
                    {city.posts.length}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {cities
            .filter((c) => activeCityTab === "all" || activeCityTab === c.id)
            .map((city) => (
              <div key={city.id} className="space-y-2 border rounded-lg p-3 bg-muted/10">
                {/* Header for City Section */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-2 border-b gap-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="font-bold text-sm text-foreground">
                      Cidade: {city.name || "Não informada"}
                    </span>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {city.posts.length} postos cadastrados
                    </Badge>
                  </div>

                  {/* Actions for this city grid */}
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddPostToCity(city.id)}
                      className="h-7 text-xs gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Adicionar Posto
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddMultiplePostsToCity(city.id, 5)}
                      className="h-7 text-xs gap-1 text-muted-foreground"
                    >
                      <Layers className="h-3 w-3" />
                      +5 Linhas
                    </Button>
                  </div>
                </div>

                {/* Spreadsheet Table for City */}
                <div className="rounded-md border bg-background overflow-x-auto shadow-sm">
                  <Table className="text-xs">
                    <TableHeader className="bg-muted/70">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-12 text-center font-mono font-bold">#</TableHead>
                        <TableHead className="w-32 font-bold">Código do Posto</TableHead>
                        <TableHead className="min-w-[220px] font-bold">
                          Posto de Trabalho / Local
                        </TableHead>
                        <TableHead className="w-52 font-bold">Função</TableHead>
                        <TableHead className="w-28 text-center font-bold">Qtd. Exigida</TableHead>
                        <TableHead className="w-28 text-center font-bold">Situação</TableHead>
                        <TableHead className="w-20 text-center font-bold">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {city.posts.map((post, postIdx) => (
                        <TableRow
                          key={post.tempId}
                          className={`hover:bg-muted/30 transition-colors ${
                            !post.active ? "opacity-60 bg-muted/10" : ""
                          }`}
                        >
                          {/* # Row Number */}
                          <TableCell className="text-center font-mono text-xs text-muted-foreground font-semibold">
                            {postIdx + 1}
                          </TableCell>

                          {/* Código do Posto */}
                          <TableCell className="p-1">
                            <Input
                              value={post.code}
                              onChange={(e) =>
                                handleUpdatePost(city.id, post.tempId, "code", e.target.value)
                              }
                              placeholder="Ex: P01"
                              className="h-8 font-mono text-xs font-semibold uppercase bg-muted/20 border-transparent hover:border-input focus:border-ring"
                            />
                          </TableCell>

                          {/* Posto de Trabalho / Local */}
                          <TableCell className="p-1">
                            <Input
                              data-city-id={city.id}
                              data-row-index={postIdx}
                              value={post.workplace}
                              onChange={(e) =>
                                handleUpdatePost(city.id, post.tempId, "workplace", e.target.value)
                              }
                              onKeyDown={(e) =>
                                handleKeyDownGrid(e, city.id, postIdx, city.posts.length)
                              }
                              placeholder="Ex: Escola Serafim, Fórum Central, UBS Centro..."
                              className="h-8 font-medium text-xs bg-transparent border-transparent hover:border-input focus:border-ring"
                            />
                          </TableCell>

                          {/* Função */}
                          <TableCell className="p-1">
                            <div className="relative">
                              <Input
                                value={post.role_name}
                                onChange={(e) =>
                                  handleUpdatePost(city.id, post.tempId, "role_name", e.target.value)
                                }
                                placeholder="Servente de Limpeza"
                                className="h-8 text-xs bg-transparent border-transparent hover:border-input focus:border-ring"
                                list={`roles-list-${city.id}`}
                              />
                              <datalist id={`roles-list-${city.id}`}>
                                {COMMON_ROLES.map((role) => (
                                  <option key={role} value={role} />
                                ))}
                              </datalist>
                            </div>
                          </TableCell>

                          {/* Quantidade Exigida */}
                          <TableCell className="p-1 text-center">
                            <Input
                              type="number"
                              min={1}
                              max={50}
                              value={post.required_qty}
                              onChange={(e) =>
                                handleUpdatePost(
                                  city.id,
                                  post.tempId,
                                  "required_qty",
                                  parseInt(e.target.value, 10) || 1
                                )
                              }
                              className="h-8 text-center font-bold text-xs bg-muted/20 border-transparent hover:border-input focus:border-ring w-20 mx-auto"
                            />
                          </TableCell>

                          {/* Situação (Ativo / Inativo) */}
                          <TableCell className="p-1 text-center">
                            <Button
                              type="button"
                              variant={post.active ? "secondary" : "outline"}
                              size="sm"
                              onClick={() =>
                                handleUpdatePost(city.id, post.tempId, "active", !post.active)
                              }
                              className={`h-7 px-2.5 text-xs font-semibold rounded-full transition-all ${
                                post.active
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-300"
                                  : "text-muted-foreground bg-muted"
                              }`}
                            >
                              {post.active ? "Ativo" : "Inativo"}
                            </Button>
                          </TableCell>

                          {/* Ações */}
                          <TableCell className="p-1 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => handleDuplicatePost(city.id, post.tempId)}
                                title="Duplicar Posto"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                onClick={() => handleRemovePost(city.id, post.tempId)}
                                title="Remover Posto"
                                disabled={city.posts.length <= 1}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      {/* 🧭 CARD 4 / BARRA DE GRAVAÇÃO EM LOTE FIXA NO RODAPÉ */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t shadow-lg px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Summary Details */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-primary" />
              {stats.totalCities} {stats.totalCities === 1 ? "Cidade" : "Cidades"}
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary" />
              {stats.totalPosts} {stats.totalPosts === 1 ? "Posto de Trabalho" : "Postos de Trabalho"}
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="font-medium text-muted-foreground flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {stats.totalRequiredStaff} Vagas Totais
            </span>
            {hasChanges && (
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium bg-amber-500/10 px-2 py-0.5 rounded">
                ● Alterações não salvas
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSaving}
              onClick={() => refetchPosts()}
              className="text-xs gap-1.5"
            >
              Descartar / Recarregar
            </Button>

            <Button
              type="button"
              variant="default"
              size="default"
              disabled={isSaving || !selectedContractId}
              onClick={handleSaveAll}
              className="font-bold text-sm px-6 gap-2 bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
            >
              {isSaving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Salvar Cidades e Postos
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
