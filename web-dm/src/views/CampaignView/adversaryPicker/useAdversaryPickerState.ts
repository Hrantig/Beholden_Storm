import * as React from "react";
import { api } from "@/services/api";
import type { Adversary } from "@/domain/types/domain";
import type { AdversaryPickerOptions } from "./types";

export function useAdversaryPickerState(args: {
  isOpen: boolean;
  onAddAdversary: (adversaryId: string, qty: number, opts: AdversaryPickerOptions) => void;
}) {
  const { isOpen, onAddAdversary } = args;

  // ── Data loading ───────────────────────────────────────────────
  const [adversaries, setAdversaries] = React.useState<Adversary[]>([]);
  const [loading, setLoading] = React.useState(false);
  const fetchedRef = React.useRef(false);

  React.useEffect(() => {
    if (!isOpen) { fetchedRef.current = false; return; }
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    api<Adversary[]>("/api/compendium/adversaries")
      .then(setAdversaries)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen]);

  // ── Filters ────────────────────────────────────────────────────
  const [searchQ, setSearchQ] = React.useState("");
  const [tierFilter, setTierFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [sizeFilter, setSizeFilter] = React.useState("all");

  const tierOptions = React.useMemo(
    () => [...new Set(adversaries.map((a) => String(a.tier)))].sort((a, b) => Number(a) - Number(b)),
    [adversaries]
  );
  const typeOptions = React.useMemo(
    () => [...new Set(adversaries.map((a) => a.adversaryType))].sort(),
    [adversaries]
  );
  const sizeOptions = React.useMemo(
    () => [...new Set(adversaries.map((a) => a.size))].sort(),
    [adversaries]
  );

  const filteredAdversaries = React.useMemo(() => {
    const q = searchQ.toLowerCase().trim();
    return adversaries.filter((a) => {
      if (q && !a.name.toLowerCase().includes(q)) return false;
      if (tierFilter !== "all" && String(a.tier) !== tierFilter) return false;
      if (typeFilter !== "all" && a.adversaryType !== typeFilter) return false;
      if (sizeFilter !== "all" && a.size !== sizeFilter) return false;
      return true;
    });
  }, [adversaries, searchQ, tierFilter, typeFilter, sizeFilter]);

  // ── Selection ──────────────────────────────────────────────────
  const [selectedAdversaryId, setSelectedAdversaryId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!filteredAdversaries.length) return;
    if (!selectedAdversaryId || !filteredAdversaries.some((a) => a.id === selectedAdversaryId)) {
      setSelectedAdversaryId(filteredAdversaries[0]!.id);
    }
  }, [filteredAdversaries, selectedAdversaryId]);

  const selectedAdversary = React.useMemo(
    () => adversaries.find((a) => a.id === selectedAdversaryId) ?? null,
    [adversaries, selectedAdversaryId]
  );

  // ── Per-adversary instance state ───────────────────────────────
  const [hpById, setHpById] = React.useState<Record<string, string>>({});
  const [qtyById, setQtyById] = React.useState<Record<string, number>>({});
  const [friendlyById, setFriendlyById] = React.useState<Record<string, boolean>>({});
  const [labelById, setLabelById] = React.useState<Record<string, string>>({});

  // Seed defaults when adversary is first selected
  React.useEffect(() => {
    if (!selectedAdversary) return;
    const id = selectedAdversary.id;
    setHpById((prev) => (prev[id] != null ? prev : { ...prev, [id]: String(Math.round((selectedAdversary.hpRangeMin + selectedAdversary.hpRangeMax) / 2)) }));
    setQtyById((prev) => (prev[id] != null ? prev : { ...prev, [id]: 1 }));
    setFriendlyById((prev) => (prev[id] != null ? prev : { ...prev, [id]: false }));
    setLabelById((prev) => (prev[id] != null ? prev : { ...prev, [id]: "" }));
  }, [selectedAdversary]);

  // ── Setters ────────────────────────────────────────────────────
  const setHpForId = (id: string, v: string) => setHpById((prev) => ({ ...prev, [id]: v }));
  const setQtyForId = (id: string, v: number) => setQtyById((prev) => ({ ...prev, [id]: v }));
  const setFriendlyForId = (id: string, v: boolean) => setFriendlyById((prev) => ({ ...prev, [id]: v }));
  const setLabelForId = (id: string, v: string) => setLabelById((prev) => ({ ...prev, [id]: v }));

  // ── Add action ─────────────────────────────────────────────────
  const handleAddAdversary = React.useCallback(
    (adversaryId: string) => {
      const adversary = adversaries.find((a) => a.id === adversaryId);
      if (!adversary) return;
      const qty = qtyById[adversaryId] ?? 1;
      const hp = Number(hpById[adversaryId] ?? adversary.hpRangeMax);
      const opts: AdversaryPickerOptions = {
        hp: Number.isFinite(hp) ? hp : adversary.hpRangeMax,
        hpRangeMin: adversary.hpRangeMin,
        hpRangeMax: adversary.hpRangeMax,
        qty,
        friendly: friendlyById[adversaryId] ?? false,
        label: labelById[adversaryId] ?? "",
        dualPhase: adversary.dualPhase ?? false,
      };
      onAddAdversary(adversaryId, qty, opts);
    },
    [adversaries, hpById, qtyById, friendlyById, labelById, onAddAdversary]
  );

  // ── Clear filters ──────────────────────────────────────────────
  const clearFilters = React.useCallback(() => {
    setSearchQ("");
    setTierFilter("all");
    setTypeFilter("all");
    setSizeFilter("all");
  }, []);

  return {
    adversaries,
    filteredAdversaries,
    loading,

    searchQ, setSearchQ,
    tierFilter, setTierFilter,
    typeFilter, setTypeFilter,
    sizeFilter, setSizeFilter,
    tierOptions, typeOptions, sizeOptions,

    selectedAdversaryId, setSelectedAdversaryId,
    selectedAdversary,

    hpById, qtyById, friendlyById, labelById,
    setHpForId, setQtyForId, setFriendlyForId, setLabelForId,

    handleAddAdversary,
    clearFilters,
  };
}
