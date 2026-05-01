import * as React from "react";
import { Modal } from "@/components/overlay/Modal";
import { AdversaryPickerListPane } from "./AdversaryPickerListPane";
import { AdversaryPickerDetailPane } from "./AdversaryPickerDetailPane";
import { useAdversaryPickerState } from "./useAdversaryPickerState";
import type { AdversaryPickerOptions } from "./types";

export function AdversaryPickerModal(props: {
  isOpen: boolean;
  onClose: () => void;
  onAddAdversary: (adversaryId: string, qty: number, opts: AdversaryPickerOptions) => void;
  onAddAdversaryCustom?: (adversaryId: string, qty: number, opts: AdversaryPickerOptions) => void;
}) {
  const s = useAdversaryPickerState({
    isOpen: props.isOpen,
    onAddAdversary: props.onAddAdversary,
  });

  const id = s.selectedAdversaryId;
  const hp = id ? (s.hpById[id] ?? "") : "";
  const qty = id ? (s.qtyById[id] ?? 1) : 1;
  const friendly = id ? (s.friendlyById[id] ?? false) : false;
  const label = id ? (s.labelById[id] ?? "") : "";

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      title="Add adversary"
      width={1000}
    >
      <div style={{ height: "100%", minHeight: 0, overflow: "hidden", padding: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 12, height: "100%", minHeight: 0 }}>

          <AdversaryPickerListPane
            loading={s.loading}
            filteredAdversaries={s.filteredAdversaries}
            selectedAdversaryId={s.selectedAdversaryId}
            onSelectAdversary={s.setSelectedAdversaryId}
            searchQ={s.searchQ}
            onChangeSearchQ={s.setSearchQ}
            tierFilter={s.tierFilter}
            onChangeTierFilter={s.setTierFilter}
            typeFilter={s.typeFilter}
            onChangeTypeFilter={s.setTypeFilter}
            sizeFilter={s.sizeFilter}
            onChangeSizeFilter={s.setSizeFilter}
            tierOptions={s.tierOptions}
            typeOptions={s.typeOptions}
            sizeOptions={s.sizeOptions}
            onClearFilters={s.clearFilters}
          />

          <AdversaryPickerDetailPane
            selectedAdversary={s.selectedAdversary}
            hp={hp}
            qty={qty}
            label={label}
            friendly={friendly}
            onChangeHp={(v) => { if (id) s.setHpForId(id, v); }}
            onChangeQty={(v) => { if (id) s.setQtyForId(id, v); }}
            onChangeLabel={(v) => { if (id) s.setLabelForId(id, v); }}
            onChangeFriendly={(v) => { if (id) s.setFriendlyForId(id, v); }}
            onAdd={() => { if (id) s.handleAddAdversary(id); }}
            onAddCustom={props.onAddAdversaryCustom && id
              ? () => {
                  const adversary = s.selectedAdversary;
                  if (!adversary || !id) return;
                  props.onAddAdversaryCustom!(id, qty, {
                    hp: Number(hp) || adversary.hpRangeMax,
                    hpRangeMin: adversary.hpRangeMin,
                    hpRangeMax: adversary.hpRangeMax,
                    qty,
                    friendly,
                    label,
                    dualPhase: adversary.dualPhase,
                  });
                }
              : undefined
            }
          />

        </div>
      </div>
    </Modal>
  );
}