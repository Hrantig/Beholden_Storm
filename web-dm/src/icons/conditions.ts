import type { ComponentType, CSSProperties } from "react";
import {
  IconAfflicted,
  IconDetermined,
  IconDisoriented,
  IconEmpowered,
  IconEnhanced,
  IconExhausted,
  IconFocused,
  IconImmobilized,
  IconProne,
  IconRestrained,
  IconSlowed,
  IconStunned,
  IconSurprised,
  IconUnconscious,
} from "@/icons/index";

type IconComp = ComponentType<{ size?: number; title?: string; style?: CSSProperties }>;

export const conditionIconByKey: Record<string, IconComp> = {
  afflicted: IconAfflicted,
  determined: IconDetermined,
  disoriented: IconDisoriented,
  empowered: IconEmpowered,
  enhanced: IconEnhanced,
  exhausted: IconExhausted,
  focused: IconFocused,
  immobilized: IconImmobilized,
  prone: IconProne,
  restrained: IconRestrained,
  slowed: IconSlowed,
  stunned: IconStunned,
  surprised: IconSurprised,
  unconscious: IconUnconscious,
};
