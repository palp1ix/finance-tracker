import { expect, test, type Page } from '@playwright/test';

async function mockOpenRouter(page: Page) {
  await page.route(/openrouter\.ai/, async (route) => {
    const body = route.request().postData() ?? '';
    let content: string;
    if (body.includes('финансовый аналитик')) {
      content = 'Больше всего ушло на кафе — попробуй поставить лимит.';
    } else {
      const results = [0, 1, 2].map((index) => {
        const items = [
          { title: 'Кофе', amount: 4.5, categoryId: 'cafe' },
          { title: 'Такси', amount: 13.8, categoryId: 'trans' },
          { title: 'Пиво', amount: 6.78, categoryId: 'beer' },
        ][index];
        return {
          index,
          parsed: {
            title: items.title,
            amount: items.amount,
            currency: 'BYN',
            categoryId: items.categoryId,
            occurredAt: new Date().toISOString(),
            type: 'expense',
          },
        };
      });
      content = JSON.stringify({ results });
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { content } }] }),
    });
  });
}

test('добавить 3 записи → обработать → счётчик 0 → статистика обновилась', async ({ page }) => {
  await mockOpenRouter(page);

  await page.goto('/');

  // Ставим API-ключ в настройках
  await page.getByRole('button', { name: /Настройки/ }).click();
  await page.getByPlaceholder('API-ключ sk-or-…').fill('sk-or-test');
  await page.getByPlaceholder('API-ключ sk-or-…').blur();

  // Возвращаемся в заметки и добавляем записи
  await page.getByRole('button', { name: /Заметки/ }).click();
  const input = page.getByPlaceholder('Что купил? Например: кофе 4.5');
  for (const text of ['кофе 4.5', 'такси домой 13.8', 'пиво 6.78р']) {
    await input.fill(text);
    await input.press('Enter');
  }

  await expect(page.getByText('3 не в статистике')).toBeVisible();

  await page.getByRole('button', { name: /Обработать/ }).click();

  await expect(page.getByText('Всё в статистике')).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: /Статистика/ }).click();
  await expect(page.getByText('Потрачено')).toBeVisible();
  await expect(page.getByText('25,08 Br')).toBeVisible();
});
