import {test, expect} from '@playwright/test';

const prefix = process.env.TEST_SITE_PREFIX || '';
test('navigation retains styles and assets across public pages', async ({page}) => {
  test.setTimeout(90000);
  const failures: string[] = [];
  page.on('response', response => {
    if (response.status() >= 400 && ['stylesheet', 'script', 'image', 'font'].includes(response.request().resourceType())) failures.push(`${response.status()} ${response.url()}`);
  });
  page.on('pageerror', error => failures.push(error.message));
  await page.goto(prefix || '/');
  const check = async () => {
    await expect(page.locator('.site-header')).toBeVisible();
    await expect(page.locator('.header-inner')).toHaveCSS('display', 'flex');
    await expect(page.locator('main h1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('main h1').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThan(24);
  };
  await check();
  for (const path of ['/pricing', '/help', '/privacy', '/terms', '/signup', '/login']) {
    await page.locator(`.site-footer a[href="${prefix}${path}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`${prefix}${path}$`),{timeout:20000});
    await check();
    await page.reload();
    await check();
    await page.locator('.site-header .brand').click();
    await expect(page).toHaveURL(new RegExp(`${prefix || '/'}$`),{timeout:20000});
    await check();
  }
  expect(failures).toEqual([]);
});
