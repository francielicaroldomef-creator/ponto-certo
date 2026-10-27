import { useState, useEffect, useMemo, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useContracts } from "@/hooks/use-auth";
import { upsertContractPostsBatch, type BatchPostInput } from "@/lib/data";
import { RS_CITIES, isRSCity } from "@/lib/rs-cities";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
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
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  ChevronsUpDown,
  X,
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

interface RSCityComboboxProps {
  value: string;
  onChange: (city: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function RSCityCombobox({
  value,
  onChange,
  placeholder = "Selecione o município do RS...",
  disabled = false,
}: RSCityComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredCities = useMemo(() => {
    if (!search.trim()) return RS_CITIES;
    const term = search
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return RS_CITIES.filter((city) => {
      const normalizedCity = city
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return normalizedCity.includes(term);
    });
  }, [search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between h-10 font-normal text-left px-3 border-input bg-background hover:bg-muted/30 transition-colors",
            !value && "text-muted-foreground"
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <MapPin className="h-4 w-4 shrink-0 text-primary" />
            {value ? (
              <span className="font-semibold text-foreground truncate">{value}</span>
            ) : (
              <span className="truncate text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {value && (
              <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 border-primary/30 text-primary bg-primary/5">
                RS
              </Badge>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0 shadow-lg border-border" align="start">
        <Command shouldFilter={false} className="max-h-[340px]">
          <CommandInput
            placeholder="Buscar entre os 497 municípios do RS..."
            value={search}
            onValueChange={setSearch}
            className="h-10"
          />
          <CommandList className="max-h-[280px] overflow-y-auto">
            {filteredCities.length === 0 ? (
              <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                Nenhum município encontrado com "{search}".
              </CommandEmpty>
            ) : (
              <CommandGroup heading={`497 Municípios Oficiais do RS (${filteredCities.length})`}>
                {filteredCities.map((city) => {
                  const isSelected = value.toLowerCase() === city.toLowerCase();
                  return (
                    <CommandItem
                      key={city}
                      value={city}
                      onSelect={() => {
                        onChange(city);
                        setOpen(false);
                        setSearch("");
                      }}
                      className="cursor-pointer flex items-center justify-between py-2 text-sm"
                    >
                      <span className={isSelected ? "font-bold text-primary" : "text-foreground"}>
                        {city}
                      </span>
                      {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

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

  // LIMITES OFICIAIS DO CONTRATO
  const contractLimitPosts = useMemo(() => {
    const rawPosts = (selectedContract as any)?.required_posts;
    const rawHeadcount = selectedContract?.required_headcount;
    if (typeof rawPosts === "number" && rawPosts > 0) return rawPosts;
    if (typeof rawHeadcount === "number" && rawHeadcount > 0) return rawHeadcount;
    return 30; // Padrão oficial CT-001 PGE
  }, [selectedContract]);

  const contractLimitStaff = useMemo(() => {
    const rawHeadcount = selectedContract?.required_headcount;
    if (typeof rawHeadcount === "number" && rawHeadcount > 0) return rawHeadcount;
    return 30; // Padrão oficial CT-001 PGE
  }, [selectedContract]);

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
      // Group loaded posts by city (with localStorage backup support)
      let localCityMap: Record<string, string> = {};
      let localWorkplaceMap: Record<string, string> = {};
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          localCityMap = JSON.parse(
            localStorage.getItem(`posts_meta_cities_${selectedContractId}`) || "{}"
          );
          localWorkplaceMap = JSON.parse(
            localStorage.getItem(`posts_meta_workplaces_${selectedContractId}`) || "{}"
          );
        }
      } catch (_) {}

      const cityMap = new Map<string, PostGridItem[]>();

      for (const p of rawPosts) {
        const cityName = (
          p.city ||
          localCityMap[p.code] ||
          selectedContract?.city ||
          "Erechim"
        ).trim();
        const workplaceName = (
          p.workplace ||
          localWorkplaceMap[p.code] ||
          (selectedContract?.code === "CT-001" ? "Escola Serafim" : "")
        ).trim();

        const item: PostGridItem = {
          tempId: p.id,
          id: p.id,
          code: p.code || "",
          workplace: workplaceName,
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
      // Carga inicial: distribui os postos previstos no contrato
      const initialCityName = selectedContract?.city || "Erechim";
      const totalPostsToCreate = contractLimitPosts;

      const generatedPosts: PostGridItem[] = [];
      for (let i = 0; i < totalPostsToCreate; i++) {
        generatedPosts.push({
          tempId: `temp-${Date.now()}-${i + 1}`,
          code: `P${String(i + 1).padStart(2, "0")}`,
          workplace: selectedContract?.code === "CT-001" ? "Escola Serafim" : "",
          role_name: "Servente de Limpeza",
          required_qty: 1,
          active: true,
        });
      }

      setCities([
        {
          id: `city-1`,
          name: initialCityName,
          targetQty: totalPostsToCreate,
          posts: generatedPosts,
        },
      ]);
      setDeletedPostIds([]);
      setHasChanges(false);
      setActiveCityTab("all");
    }
  }, [rawPosts, selectedContractId, selectedContract?.city, contractLimitPosts]);

  // Overall Statistics & Limits Verification
  const stats = useMemo(() => {
    const totalCities = cities.length;
    let totalPlannedPosts = 0;
    let totalActualPosts = 0;
    let totalAllocatedStaff = 0;
    let activePostsCount = 0;

    for (const c of cities) {
      totalPlannedPosts += c.targetQty || 0;
      totalActualPosts += c.posts.length;
      for (const p of c.posts) {
        if (p.active) {
          activePostsCount++;
          totalAllocatedStaff += p.required_qty || 1;
        }
      }
    }

    const remainingPosts = contractLimitPosts - totalPlannedPosts;
    const remainingStaff = contractLimitStaff - totalAllocatedStaff;
    const isExactMatch = totalPlannedPosts === contractLimitPosts && totalAllocatedStaff === contractLimitStaff;
    const isExceeded = totalPlannedPosts > contractLimitPosts || totalAllocatedStaff > contractLimitStaff;

    return {
      totalCities,
      totalPlannedPosts,
      totalActualPosts,
      totalAllocatedStaff,
      activePostsCount,
      remainingPosts,
      remainingStaff,
      isExactMatch,
      isExceeded,
    };
  }, [cities, contractLimitPosts, contractLimitStaff]);

  // Enforce/Reset to the 30 official posts (P01 a P30)
  const handleRestore30Posts = useCallback(() => {
    const cityName = selectedContract?.city || "Erechim";
    const officialPosts: PostGridItem[] = [];
    const removedIds: string[] = [];

    // Track any post IDs beyond 30 to remove from DB on save
    if (rawPosts) {
      for (const p of rawPosts) {
        const num = parseInt(p.code.replace(/\D/g, ""), 10);
        if (num > 30 || !p.code.startsWith("P")) {
          removedIds.push(p.id);
        }
      }
    }

    for (let i = 1; i <= 30; i++) {
      const code = `P${String(i).padStart(2, "0")}`;
      const existing = rawPosts?.find((p) => p.code === code);
      officialPosts.push({
        tempId: existing?.id || `temp-${Date.now()}-${i}`,
        id: existing?.id,
        code,
        workplace: existing?.workplace || "Escola Serafim",
        role_name: existing?.role_name || "Servente de Limpeza",
        required_qty: 1,
        active: true,
      });
    }

    setCities([
      {
        id: "city-1",
        name: cityName,
        targetQty: 30,
        posts: officialPosts,
      },
    ]);
    if (removedIds.length > 0) {
      setDeletedPostIds((prev) => [...prev, ...removedIds]);
    }
    setHasChanges(true);
    setActiveCityTab("all");
    toast.info("Ajustado para os 30 postos oficiais (P01 a P30). Clique em 'Salvar Cidades e Postos' para sincronizar.");
  }, [rawPosts, selectedContract?.city]);

  // --- Handlers for Cidades (Card 2) ---

  const handleCityCountChange = useCallback(
    (newCountRaw: number) => {
      const newCount = Math.max(1, Math.min(newCountRaw || 1, 50));
      setCities((prev) => {
        if (newCount === prev.length) return prev;

        if (newCount > prev.length) {
          // Check if there is quota remaining to distribute
          const currentPlanned = prev.reduce((s, c) => s + c.targetQty, 0);
          const availableQuota = contractLimitPosts - currentPlanned;

          if (availableQuota <= 0) {
            toast.warning(
              `Todos os ${contractLimitPosts} postos já foram distribuídos. Reduza a quantidade de postos em outra cidade para adicionar uma nova.`
            );
            return prev;
          }

          const added: CityGroupItem[] = [];
          const existingCodes = new Set(prev.flatMap((c) => c.posts.map((p) => p.code)));

          for (let i = prev.length; i < newCount; i++) {
            // Se não sobrar cota, não adiciona mais
            const currentTotalAdded = added.reduce((s, a) => s + a.targetQty, 0);
            if (currentPlanned + currentTotalAdded >= contractLimitPosts) {
              break;
            }

            const defaultName = "";
            const code = generateCode(defaultName, i, existingCodes);
            existingCodes.add(code);

            added.push({
              id: `city-${Date.now()}-${i}`,
              name: "",
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
    },
    [contractLimitPosts]
  );

  const handleAddCity = useCallback(() => {
    setCities((prev) => {
      const currentPlanned = prev.reduce((s, c) => s + c.targetQty, 0);
      const remaining = contractLimitPosts - currentPlanned;

      if (remaining <= 0) {
        toast.warning(
          `Todos os ${contractLimitPosts} postos contratados já estão distribuídos. Ajuste as quantidades existentes para liberar vagas.`
        );
        return prev;
      }

      const idx = prev.length + 1;
      const defaultName = "";
      const existingCodes = new Set(prev.flatMap((c) => c.posts.map((p) => p.code)));
      const code = generateCode(defaultName, idx - 1, existingCodes);

      return [
        ...prev,
        {
          id: `city-${Date.now()}-${idx}`,
          name: "",
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
  }, [contractLimitPosts]);

  const handleUpdateCityName = useCallback((cityId: string, newName: string) => {
    setCities((prev) =>
      prev.map((c) => (c.id === cityId ? { ...c, name: newName } : c))
    );
    setHasChanges(true);
  }, []);

  const handleUpdateCityTargetQty = useCallback(
    (cityId: string, targetQtyRaw: number) => {
      setCities((prev) => {
        const otherCitiesSum = prev
          .filter((c) => c.id !== cityId)
          .reduce((s, c) => s + c.targetQty, 0);

        const maxAllowedForThisCity = Math.max(1, contractLimitPosts - otherCitiesSum);
        let safeTarget = Math.max(1, Math.min(targetQtyRaw || 1, maxAllowedForThisCity));

        if (targetQtyRaw > maxAllowedForThisCity) {
          toast.warning(
            `Limite máximo do contrato atingido: esta cidade pode ter no máximo ${maxAllowedForThisCity} postos para não ultrapassar o total de ${contractLimitPosts}.`
          );
          safeTarget = maxAllowedForThisCity;
        }

        return prev.map((c) => {
          if (c.id !== cityId) return c;

          const currentPosts = [...c.posts];
          if (safeTarget > currentPosts.length) {
            const allCodes = new Set(prev.flatMap((x) => x.posts.map((p) => p.code)));
            for (let i = currentPosts.length; i < safeTarget; i++) {
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
            targetQty: safeTarget,
            posts: currentPosts,
          };
        });
      });
      setHasChanges(true);
    },
    [contractLimitPosts]
  );

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
            posts: c.posts.map((p) => {
              if (p.tempId !== tempId) return p;

              if (field === "required_qty") {
                const parsedQty = Math.max(1, parseInt(value, 10) || 1);
                // Check if total staff would exceed limit
                let currentTotalStaff = 0;
                for (const cityItem of prev) {
                  for (const postItem of cityItem.posts) {
                    if (postItem.tempId === tempId) {
                      currentTotalStaff += parsedQty;
                    } else {
                      currentTotalStaff += postItem.required_qty || 1;
                    }
                  }
                }

                if (currentTotalStaff > contractLimitStaff) {
                  toast.warning(
                    `O efetivo total não pode exceder as ${contractLimitStaff} pessoas contratadas.`
                  );
                  return p;
                }
                return { ...p, required_qty: parsedQty };
              }

              return { ...p, [field]: value };
            }),
          };
        })
      );
      setHasChanges(true);
    },
    [contractLimitStaff]
  );

  const handleAddPostToCity = useCallback(
    (cityId: string) => {
      setCities((prev) => {
        const totalPostsCount = prev.reduce((s, c) => s + c.posts.length, 0);
        if (totalPostsCount >= contractLimitPosts) {
          toast.error(
            `Limite máximo do contrato atingido: não é permitido cadastrar mais de ${contractLimitPosts} postos.`
          );
          return prev;
        }

        return prev.map((c) => {
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
        });
      });
      setHasChanges(true);
    },
    [contractLimitPosts]
  );

  const handleAddMultiplePostsToCity = useCallback(
    (cityId: string, count: number = 5) => {
      setCities((prev) => {
        const totalPostsCount = prev.reduce((s, c) => s + c.posts.length, 0);
        const available = contractLimitPosts - totalPostsCount;

        if (available <= 0) {
          toast.error(
            `Limite de ${contractLimitPosts} postos já atingido. Não é permitido adicionar mais postos.`
          );
          return prev;
        }

        const countToAdd = Math.min(count, available);

        return prev.map((c) => {
          if (c.id !== cityId) return c;
          const allCodes = new Set(prev.flatMap((x) => x.posts.map((p) => p.code)));
          const newPosts: PostGridItem[] = [];

          for (let i = 0; i < countToAdd; i++) {
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
            targetQty: c.posts.length + countToAdd,
            posts: [...c.posts, ...newPosts],
          };
        });
      });
      setHasChanges(true);
    },
    [contractLimitPosts]
  );

  const handleDuplicatePost = useCallback(
    (cityId: string, tempId: string) => {
      setCities((prev) => {
        const totalPostsCount = prev.reduce((s, c) => s + c.posts.length, 0);
        if (totalPostsCount >= contractLimitPosts) {
          toast.error(
            `Limite máximo do contrato atingido (${contractLimitPosts} postos). Não é permitido duplicar.`
          );
          return prev;
        }

        return prev.map((c) => {
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
        });
      });
      setHasChanges(true);
    },
    [contractLimitPosts]
  );

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

    // Validação estrita de limites
    if (stats.totalActualPosts > contractLimitPosts) {
      toast.error(
        `Bloqueado: O número de postos cadastrados (${stats.totalActualPosts}) não pode exceder o total contratado (${contractLimitPosts}).`
      );
      return;
    }

    if (stats.totalAllocatedStaff > contractLimitStaff) {
      toast.error(
        `Bloqueado: O efetivo alocado (${stats.totalAllocatedStaff}) não pode exceder as ${contractLimitStaff} vagas do contrato.`
      );
      return;
    }

    // Validate that cities have names and belong to official 497 RS municipalities
    for (let i = 0; i < cities.length; i++) {
      if (!cities[i].name.trim() || !isRSCity(cities[i].name.trim())) {
        toast.error(`Selecione um município oficial do RS na linha #${i + 1} entre os 497 disponíveis.`);
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

      // Sincronizar cidade principal no contrato se aplicável
      if (cities[0]?.name) {
        try {
          await supabase
            .from("contracts")
            .update({ city: cities[0].name.trim() })
            .eq("id", selectedContractId);
        } catch (contractCityErr) {
          console.warn("[Postos] Aviso ao atualizar cidade no contrato:", contractCityErr);
        }
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
      {/* Datalist global padronizado com as cidades do RS */}
      <datalist id="rs-cities-datalist">
        {RS_CITIES.map((cidade) => (
          <option key={cidade} value={cidade} />
        ))}
      </datalist>

      {/* Top Banner / Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Table2 className="h-6 w-6 text-primary" />
            Distribuição de Postos e Cidades
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestão operacional por contrato e cidades do Rio Grande do Sul limitada rigorosamente ao previsto no contrato.
          </p>
        </div>

        {/* Global Stats Overview */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 font-mono text-xs flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-semibold text-foreground">{stats.totalCities}</span> Cidades (RS)
          </Badge>
          <Badge
            variant={stats.isExactMatch ? "secondary" : "outline"}
            className={`px-3 py-1 font-mono text-xs flex items-center gap-1.5 ${
              stats.isExactMatch
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-300"
                : ""
            }`}
          >
            <MapPin className="h-3.5 w-3.5" />
            <span className="font-semibold">{stats.totalActualPosts} / {contractLimitPosts}</span> Postos
          </Badge>
          <Badge
            variant={stats.isExactMatch ? "secondary" : "outline"}
            className={`px-3 py-1 font-mono text-xs flex items-center gap-1.5 ${
              stats.isExactMatch
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-300"
                : ""
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span className="font-semibold">{stats.totalAllocatedStaff} / {contractLimitStaff}</span> Efetivo
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
                Seleção do Contrato de Atuação e Limites Contratuais
              </CardTitle>
              <CardDescription>
                A quantidade de postos e efetivo cadastrados no contrato serve como limite inegociável para a distribuição nas cidades.
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
              <div className="rounded-lg border bg-muted/40 p-2.5 text-xs space-y-1.5">
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
                <div className="flex items-center justify-between border-t pt-1">
                  <span className="text-muted-foreground">Postos Contratados:</span>
                  <span className="font-bold text-primary font-mono text-xs">
                    {contractLimitPosts} Postos
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Efetivo Contratado:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-xs">
                    {selectedContract.required_headcount || 30} Postos
                  </span>
                </div>
                {selectedContract.code === "CT-001" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRestore30Posts}
                    className="w-full mt-1 h-7 text-[11px] gap-1.5 font-semibold text-primary hover:bg-primary/10 border-primary/30"
                    title="Restaura a grade para os 30 postos oficiais (P01 a P30) do contrato PGE"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Restaurar 30 Postos Oficiais (P01 a P30)
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 🧭 CARD 2: Cidades de Atuação (RS) e Distribuição da Cota */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  2
                </span>
                Cidades de Atuação no Rio Grande do Sul (Grade Excel)
              </CardTitle>
              <CardDescription>
                Selecione individualmente entre os <strong>497 municípios do RS</strong> e distribua os <strong>{contractLimitPosts} postos</strong> sem pré-seleção forçada e respeitando os limites contratuais.
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
                max={contractLimitPosts}
                className="w-20 h-8 text-center font-bold bg-background text-sm"
                value={cities.length}
                onChange={(e) => handleCityCountChange(parseInt(e.target.value, 10))}
              />
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleAddCity}
                disabled={stats.remainingPosts <= 0}
                className="h-8 gap-1.5 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar Cidade
              </Button>
            </div>
          </div>

          {/* Barra de Status da Distribuição (Limites Inegociáveis) */}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 p-3 rounded-lg border bg-muted/30 text-xs">
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <span className="text-muted-foreground">Postos Contratados:</span>
              <span className="font-bold text-foreground font-mono">{contractLimitPosts}</span>
            </div>
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <span className="text-muted-foreground">Postos Distribuídos:</span>
              <span className={`font-bold font-mono ${stats.totalPlannedPosts === contractLimitPosts ? "text-emerald-600" : "text-amber-600"}`}>
                {stats.totalPlannedPosts} / {contractLimitPosts}
              </span>
            </div>
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <span className="text-muted-foreground">Saldo a Distribuir:</span>
              <span className={`font-bold font-mono ${stats.remainingPosts === 0 ? "text-emerald-600" : stats.remainingPosts < 0 ? "text-destructive" : "text-amber-600"}`}>
                {stats.remainingPosts} {stats.remainingPosts === 1 ? "posto" : "postos"}
              </span>
            </div>
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <span className="text-muted-foreground">Status do Efetivo:</span>
              <span className={`font-bold font-mono ${stats.totalAllocatedStaff === contractLimitStaff ? "text-emerald-600" : "text-amber-600"}`}>
                {stats.totalAllocatedStaff} / {contractLimitStaff} vagas
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-lg border bg-background overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-muted/60">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12 text-center text-xs font-mono font-bold">#</TableHead>
                  {/* Coluna de cidade alargada e com seletor individual padronizado dos 497 municípios */}
                  <TableHead className="min-w-[380px] text-xs font-bold">
                    Cidade de Atuação no Rio Grande do Sul (497 Municípios Oficiais)
                  </TableHead>
                  <TableHead className="w-72 text-center text-xs font-bold">
                    Qtd. de Postos Previstos nesta Cidade
                  </TableHead>
                  <TableHead className="w-24 text-center text-xs font-bold">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cities.map((city, idx) => {
                  return (
                    <TableRow key={city.id} className="hover:bg-muted/20">
                      {/* # Index */}
                      <TableCell className="text-center font-mono text-xs font-medium text-muted-foreground">
                        {idx + 1}
                      </TableCell>

                      {/* Nome da Cidade de Atuação (RS) - ALARGADO COM SELEÇÃO INDIVIDUAL DOS 497 MUNICÍPIOS */}
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <RSCityCombobox
                              value={city.name}
                              onChange={(selected) => handleUpdateCityName(city.id, selected)}
                              placeholder="Selecione o município do RS (497 opções)..."
                            />
                          </div>
                          {city.name && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                              onClick={() => handleUpdateCityName(city.id, "")}
                              title="Limpar seleção para escolher outro município"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>

                      {/* Postos Previstos na Cidade */}
                      <TableCell className="text-center py-2">
                        <div className="flex items-center justify-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            max={contractLimitPosts}
                            value={city.targetQty}
                            onChange={(e) =>
                              handleUpdateCityTargetQty(city.id, parseInt(e.target.value, 10))
                            }
                            className="w-24 h-9 text-center font-bold text-sm bg-muted/20 border-input"
                          />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            postos (máx: {contractLimitPosts})
                          </span>
                        </div>
                      </TableCell>

                      {/* Ações */}
                      <TableCell className="text-center py-2">
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
                Postos de Trabalho Distribuídos por Cidade (Grade Estilo Planilha)
              </CardTitle>
              <CardDescription>
                Edição contínua dos locais e funções. O total de linhas e efetivo não pode ultrapassar o contratado ({contractLimitPosts} postos / {contractLimitStaff} vagas).
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
                🏢 Todas as Cidades ({stats.totalActualPosts})
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
                      {city.posts.length} postos cadastrados (meta: {city.targetQty})
                    </Badge>
                  </div>

                  {/* Actions for this city grid */}
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={stats.totalActualPosts >= contractLimitPosts}
                      onClick={() => handleAddPostToCity(city.id)}
                      className="h-7 text-xs gap-1"
                      title={stats.totalActualPosts >= contractLimitPosts ? "Limite do contrato atingido" : ""}
                    >
                      <Plus className="h-3 w-3" />
                      Adicionar Posto
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={stats.totalActualPosts >= contractLimitPosts}
                      onClick={() => handleAddMultiplePostsToCity(city.id, 5)}
                      className="h-7 text-xs gap-1 text-muted-foreground"
                      title={stats.totalActualPosts >= contractLimitPosts ? "Limite do contrato atingido" : ""}
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

                          {/* Quantidade Exigida (Efetivo do Posto) */}
                          <TableCell className="p-1 text-center">
                            <Input
                              type="number"
                              min={1}
                              max={contractLimitStaff}
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
                                disabled={stats.totalActualPosts >= contractLimitPosts}
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
            <span
              className={`font-semibold flex items-center gap-1.5 ${
                stats.totalActualPosts === contractLimitPosts ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
              }`}
            >
              <MapPin className="h-4 w-4 text-primary" />
              {stats.totalActualPosts} / {contractLimitPosts} Postos de Trabalho
            </span>
            <span className="text-muted-foreground">•</span>
            <span
              className={`font-medium flex items-center gap-1.5 ${
                stats.totalAllocatedStaff === contractLimitStaff ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
              }`}
            >
              <Users className="h-4 w-4" />
              {stats.totalAllocatedStaff} / {contractLimitStaff} Vagas Totais
            </span>
            {stats.isExactMatch && (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-300 text-xs">
                Distribuição Completa (100%)
              </Badge>
            )}
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
              disabled={isSaving || !selectedContractId || stats.isExceeded}
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
