/**
 * The ONLY place that maps template colors to display classes. Class names are full literal
 * strings so Tailwind keeps them (tokens: --color-tpl-* in index.css).
 */
import { TemplateColor } from '@/types/schema';
import type { EventTemplate } from '@/types/entities';

export type PaletteKey = 'teal' | 'violet' | 'sky' | 'magenta' | 'olive' | 'brown' | 'neutral';

export interface PaletteEntry {
  key: PaletteKey;
  label: string;
  /** Soft chip fill. */
  bg: string;
  /** Strong fill for dots, bars and pills (pair with text-white). */
  solid: string;
  /** Text on `bg`. */
  text: string;
  /** Outline/ring in the strong color. */
  ring: string;
}

export const TEMPLATE_PALETTE: Record<PaletteKey, PaletteEntry> = {
  teal: { key: 'teal', label: 'Teal', bg: 'bg-tpl-teal-bg', solid: 'bg-tpl-teal', text: 'text-tpl-teal-text', ring: 'ring-tpl-teal' },
  violet: { key: 'violet', label: 'Violet', bg: 'bg-tpl-violet-bg', solid: 'bg-tpl-violet', text: 'text-tpl-violet-text', ring: 'ring-tpl-violet' },
  sky: { key: 'sky', label: 'Sky', bg: 'bg-tpl-sky-bg', solid: 'bg-tpl-sky', text: 'text-tpl-sky-text', ring: 'ring-tpl-sky' },
  magenta: { key: 'magenta', label: 'Magenta', bg: 'bg-tpl-magenta-bg', solid: 'bg-tpl-magenta', text: 'text-tpl-magenta-text', ring: 'ring-tpl-magenta' },
  olive: { key: 'olive', label: 'Olive', bg: 'bg-tpl-olive-bg', solid: 'bg-tpl-olive', text: 'text-tpl-olive-text', ring: 'ring-tpl-olive' },
  brown: { key: 'brown', label: 'Brown', bg: 'bg-tpl-brown-bg', solid: 'bg-tpl-brown', text: 'text-tpl-brown-text', ring: 'ring-tpl-brown' },
  neutral: { key: 'neutral', label: 'No template', bg: 'bg-tpl-neutral-bg', solid: 'bg-tpl-neutral', text: 'text-tpl-neutral-text', ring: 'ring-tpl-neutral' },
};

/** Choice value → palette key, in option order (also the swatch order in the editor). */
export const TEMPLATE_COLOR_OPTIONS: { value: TemplateColor; key: PaletteKey }[] = [
  { value: TemplateColor.Teal, key: 'teal' },
  { value: TemplateColor.Violet, key: 'violet' },
  { value: TemplateColor.Sky, key: 'sky' },
  { value: TemplateColor.Magenta, key: 'magenta' },
  { value: TemplateColor.Olive, key: 'olive' },
  { value: TemplateColor.Brown, key: 'brown' },
];

/** Small, stable string hash (djb2) — same id → same automatic color on every device. */
function hash(value: string): number {
  let h = 5381;
  for (let i = 0; i < value.length; i++) h = ((h << 5) + h + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Automatic color for a template without one. */
export function automaticColor(templateId: string): PaletteEntry {
  const option = TEMPLATE_COLOR_OPTIONS[hash(templateId.toLowerCase()) % TEMPLATE_COLOR_OPTIONS.length];
  return TEMPLATE_PALETTE[option?.key ?? 'neutral'];
}

/**
 * Chosen color → that entry; template without a color → stable automatic color;
 * no template → Neutral.
 */
export function colorForTemplate(template: Pick<EventTemplate, 'id' | 'color'> | null | undefined): PaletteEntry {
  if (!template) return TEMPLATE_PALETTE.neutral;
  const chosen = TEMPLATE_COLOR_OPTIONS.find((o) => o.value === template.color);
  return chosen ? TEMPLATE_PALETTE[chosen.key] : automaticColor(template.id);
}
