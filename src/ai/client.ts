const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class AiError extends Error {
  code: string;
  status?: number;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = 'AiError';
    this.code = code;
    this.status = status;
  }
}

function friendlyMessage(status: number): string {
  switch (status) {
    case 401:
      return 'Неверный API-ключ. Проверь его в настройках.';
    case 402:
      return 'На OpenRouter нет средств (лимит). Пополни баланс.';
    case 403:
      return 'Модель недоступна для этого ключа.';
    case 429:
      return 'Слишком много запросов — попробуй чуть позже.';
    case 500:
    case 502:
    case 503:
      return 'OpenRouter временно недоступен. Попробуй ещё раз.';
    default:
      return `Ошибка OpenRouter (${status}).`;
  }
}

export async function chatCompletion(
  key: string,
  model: string,
  messages: ChatMessage[],
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onOuterAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onOuterAbort);

  try {
    let res: Response;
    try {
      res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
          'HTTP-Referer': typeof location !== 'undefined' ? location.origin : 'https://traty.app',
          'X-Title': 'Траты — заметки с ИИ',
        },
        body: JSON.stringify({ model, messages, response_format: { type: 'json_object' } }),
        signal: controller.signal,
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        throw new AiError('timeout', 'Время ожидания истекло. Проверь сеть и попробуй снова.');
      }
      throw new AiError('network', 'Нет сети. Записи останутся в очереди.');
    }

    if (!res.ok) {
      throw new AiError('http', friendlyMessage(res.status), res.status);
    }

    const data: unknown = await res.json();
    const content = extractContent(data);
    if (!content) {
      throw new AiError('empty', 'Модель вернула пустой ответ. Попробуй ещё раз.');
    }
    return content;
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onOuterAbort);
  }
}

function extractContent(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as { choices?: Array<{ message?: { content?: unknown } }> };
  const content = d.choices?.[0]?.message?.content;
  if (typeof content === 'string' && content.length > 0) return content;
  return null;
}

/** Толерантно достаёт JSON из ответа модели (игнорирует обёртки в ```json … ```). */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new AiError('parse', 'Не удалось разобрать ответ модели (не JSON).');
  }
}
