import type { Adversary } from "@/domain/types/domain";

export type { Adversary };

export interface AdversaryPickerOptions {
  hp: number;
  hpRangeMin: number;
  hpRangeMax: number;
  qty: number;
  friendly: boolean;
  label: string;
  dualPhase: boolean;
}
