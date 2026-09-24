import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function drag(page: Page, from: Locator, to: Locator) {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 3 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
}

async function createBoard(page: Page, name: string, text: string) {
  await page.goto('/');
  await page.getByRole('link', { name: /create your first board|new board/i }).first().click();
  await page.getByLabel('Board name').fill(name);
  await page.getByPlaceholder(/doctor\/nurse/).fill(text);
  await expect(page.getByText(/items? found/)).toContainText('5');
  await page.getByRole('button', { name: /review 5 items/i }).click();
}

test('full workflow: parse, review, group, persist, export', async ({ page }) => {
  await createBoard(page, 'Jobs', 'doctor/nurse/pharmacist/customer service/product quality');

  // Review: edit, remove, add.
  await page.getByRole('textbox', { name: 'Item 5', exact: true }).fill('quality control');
  await page.getByRole('button', { name: 'Remove item 4' }).click();
  await page.getByLabel('New item').fill('surgeon');
  await page.getByRole('button', { name: '+ Add item' }).click();
  await page.getByRole('button', { name: /create board with 5 items/i }).click();

  // Board: five loose cards, none overlapping.
  const cards = page.locator('.layer-cards .card');
  await expect(cards).toHaveCount(5);
  await expect(page.locator('.card', { hasText: 'customer service' })).toHaveCount(0);
  const boxes = await Promise.all((await cards.all()).map((c) => c.boundingBox()));
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const [p, q] = [boxes[i]!, boxes[j]!];
      const overlap = p.x < q.x + q.width && q.x < p.x + p.width && p.y < q.y + q.height && q.y < p.y + p.height;
      expect(overlap).toBe(false);
    }

  // Create and name a bucket.
  await page.getByRole('button', { name: '+ Bucket' }).click();
  const nameInput = page.getByLabel('Bucket name');
  await nameInput.fill('Healthcare');
  await nameInput.press('Enter');
  const bucket = page.locator('.bucket', { hasText: 'Healthcare' });
  await expect(bucket).toBeVisible();

  // Drag two items in, checking drop feedback.
  for (const t of ['doctor', 'nurse']) {
    await drag(page, page.locator('.layer-cards .card', { hasText: t }), bucket.locator('.bucket-body'));
    await expect(bucket).toHaveClass(/is-drop-target/);
    await expect(page.getByText('Drop into “Healthcare”')).toBeVisible();
    await page.mouse.up();
  }
  await expect(bucket.locator('.chip')).toHaveCount(2);
  await expect(bucket.locator('.bucket-count')).toHaveText('2');
  await expect(cards).toHaveCount(3);

  // Undo / redo.
  await page.keyboard.press('Control+z');
  await expect(bucket.locator('.chip')).toHaveCount(1);
  await page.keyboard.press('Control+Shift+z');
  await expect(bucket.locator('.chip')).toHaveCount(2);

  // Drag a chip back out onto the board.
  await drag(page, bucket.locator('.chip', { hasText: 'nurse' }), page.locator('.hint-bar'));
  await page.mouse.move(700, 800, { steps: 5 });
  await page.mouse.up();
  await expect(bucket.locator('.chip')).toHaveCount(1);
  await page.keyboard.press('Control+z');
  await expect(bucket.locator('.chip')).toHaveCount(2);

  // Edit an item on the board.
  await page.locator('.layer-cards .card', { hasText: 'surgeon' }).dblclick();
  await page.getByLabel('Edit item').fill('surgeon general');
  await page.keyboard.press('Enter');
  await expect(page.locator('.layer-cards .card', { hasText: 'surgeon general' })).toBeVisible();

  // Persisted across reloads.
  await expect(page.locator('.save-status')).toHaveText(/Saved/);
  await page.reload();
  await expect(page.locator('.bucket', { hasText: 'Healthcare' }).locator('.chip')).toHaveCount(2);
  await expect(page.locator('.layer-cards .card')).toHaveCount(3);
  await expect(page.getByText('surgeon general')).toBeVisible();

  // Export text + CSV.
  await page.getByRole('button', { name: 'Export ▾' }).click();
  await page.getByRole('menuitem', { name: /as text/ }).click();
  const preview = page.getByLabel('Export preview');
  await expect(preview).toHaveValue(/^Healthcare\ndoctor\nnurse\n\nUngrouped\n/);
  await page.getByRole('tab', { name: 'CSV' }).click();
  await expect(preview).toHaveValue(/^bucket,item\r?\nHealthcare,doctor\r?\nHealthcare,nurse/);
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download .csv' }).click()]);
  expect(csv.suggestedFilename()).toBe('Jobs.csv');
  expect(await readFile((await csv.path())!, 'utf8')).toContain('Healthcare,doctor');
  await page.getByRole('button', { name: 'Close' }).click();

  // Export PNG.
  await page.getByRole('button', { name: 'Export ▾' }).click();
  const [png] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /image/i }).click()]);
  expect(png.suggestedFilename()).toBe('Jobs.png');
  const bytes = await readFile((await png.path())!);
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');

  // Delete bucket (with confirmation): items return to the board.
  await bucket.getByRole('button', { name: /bucket options/i }).click();
  await page.getByRole('menuitem', { name: 'Delete bucket' }).click();
  await expect(page.getByRole('heading', { name: /delete bucket/i })).toBeVisible();
  await page.getByRole('button', { name: 'Delete bucket' }).click();
  await expect(page.locator('.bucket')).toHaveCount(0);
  await expect(page.locator('.layer-cards .card')).toHaveCount(5);

  // Board shows on the home page.
  await page.getByRole('link', { name: /back to all boards/i }).click();
  await expect(page.getByText('Jobs')).toBeVisible();
});

test('custom delimiter, file upload and malformed input', async ({ page }) => {
  await page.goto('/#/new');
  const textarea = page.getByPlaceholder(/doctor\/nurse/);
  await textarea.fill('   ///  / ');
  await expect(page.getByText(/no items found/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /review/i })).toBeDisabled();

  await textarea.fill('red; green ;blue;;');
  await expect(page.getByText(/only one item found/i)).toBeVisible();
  await page.getByRole('radio', { name: ';' }).click();
  await expect(page.getByText(/items? found/)).toContainText('3');

  await page.getByRole('tab', { name: 'Upload file' }).click();
  await page.getByTestId('file-input').setInputFiles({ name: 'list.txt', mimeType: 'text/plain', buffer: Buffer.from('a|b|c|d') });
  await expect(page.getByText('Loaded “list.txt”')).toBeVisible();
  await page.getByRole('radio', { name: '|' }).click();
  await expect(page.getByText(/items? found/)).toContainText('4');

  await page.getByTestId('file-input').setInputFiles({ name: 'bin.txt', mimeType: 'text/plain', buffer: Buffer.from([0, 1, 2, 0, 3]) });
  await expect(page.getByText(/doesn't look like a plain text file/)).toBeVisible();
});

test('empty board, reset grouping and re-randomize', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('tab', { name: 'Start empty' }).click();
  await page.getByRole('button', { name: 'Create empty board' }).click();
  await expect(page.getByText('This board is empty.')).toBeVisible();

  await page.getByRole('button', { name: '+ Items' }).click();
  await page.getByRole('dialog', { name: 'Add items' }).getByPlaceholder(/doctor\/nurse/).fill('a/b/c/d');
  await page.getByRole('button', { name: /review 4 items/i }).click();
  await page.getByRole('button', { name: /add 4 items to board/i }).click();
  await expect(page.locator('.layer-cards .card')).toHaveCount(4);

  // Double-click empty space creates a bucket.
  await page.getByTestId('board-viewport').dblclick({ position: { x: 1200, y: 700 } });
  await page.keyboard.type('Letters');
  await page.keyboard.press('Enter');
  const bucket = page.locator('.bucket', { hasText: 'Letters' });
  await drag(page, page.locator('.layer-cards .card', { hasText: 'a' }).first(), bucket);
  await page.mouse.up();
  await expect(bucket.locator('.chip')).toHaveCount(1);

  const before = await page.locator('.layer-cards .card').first().boundingBox();
  await page.getByRole('button', { name: /shuffle/i }).click();
  await expect.poll(async () => JSON.stringify(await page.locator('.layer-cards .card').first().boundingBox())).not.toBe(JSON.stringify(before));
  await expect(bucket.locator('.chip')).toHaveCount(1);

  await page.getByRole('button', { name: 'Reset…' }).click();
  await page.getByLabel('Also delete all buckets').check();
  await page.getByRole('button', { name: 'Reset grouping' }).click();
  await expect(page.locator('.bucket')).toHaveCount(0);
  await expect(page.locator('.layer-cards .card')).toHaveCount(4);
});
