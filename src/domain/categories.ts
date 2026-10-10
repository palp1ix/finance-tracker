import type { Category } from './types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'food', emoji: '🍕', name: 'Еда', color: '#F59E0B' },
  { id: 'cafe', emoji: '🍽️', name: 'Кафе', color: '#EF4444' },
  { id: 'beer', emoji: '🍺', name: 'Алкоголь', color: '#8B5CF6' },
  { id: 'smoke', emoji: '💨', name: 'Стики', color: '#64748B' },
  { id: 'trans', emoji: '🛴', name: 'Транспорт', color: '#06B6D4' },
  { id: 'health', emoji: '💊', name: 'Здоровье', color: '#10B981' },
  { id: 'sub', emoji: '📱', name: 'Подписки', color: '#5B5BF0' },
  { id: 'fun', emoji: '🎬', name: 'Развлечения', color: '#F97316' },
  { id: 'shop', emoji: '🛍️', name: 'Покупки', color: '#EC4899' },
  { id: 'other', emoji: '✨', name: 'Другое', color: '#94A3B8' },
];

export function categoryById(categories: Category[], id: string | undefined): Category {
  return categories.find((c) => c.id === id) ?? categories.find((c) => c.id === 'other') ?? categories[0];
}
