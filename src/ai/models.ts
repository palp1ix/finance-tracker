export interface ModelDef {
  id: string;
  label: string;
  model: string;
}

export const MODELS: ModelDef[] = [
  { id: 'fast', label: 'Быстрая и дешёвая', model: 'openai/gpt-4o-mini' },
  { id: 'accurate', label: 'Точная', model: 'anthropic/claude-3.5-sonnet' },
];

export function modelById(id: string): ModelDef {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}
