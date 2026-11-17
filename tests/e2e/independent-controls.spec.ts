import { expect, test } from '@playwright/test';

const camera = async (page: import('@playwright/test').Page) => JSON.parse((await page.locator('canvas').getAttribute('data-camera'))!);

test('marker hiding preserves category and selection across rejected picking and reset', async ({page}) => {
  await page.goto('/categories/stages/?poi=alchemy-circle#poi-alchemy-circle');
  const host = page.locator('[data-map-enhancement]');
  await expect(host).toHaveAttribute('data-webgl','ready');
  await expect(host).toHaveAttribute('data-selected-poi','alchemy-circle');
  const markers = page.getByRole('button',{name:'Show markers',exact:true});
  const rotate = page.getByRole('button',{name:'Rotate map',exact:true});
  const preview = page.getByRole('region',{name:'Map place preview'});
  const list = await page.locator('a[data-poi-slug]').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-poi-slug')));
  const state = await camera(page);
  const url = page.url();
  await page.evaluate(() => { (window as unknown as { selections:unknown[] }).selections=[]; window.addEventListener('poi:select',e => (window as unknown as { selections:unknown[] }).selections.push((e as CustomEvent).detail)); });
  await markers.click();
  await expect(preview).toBeHidden();
  await page.locator('canvas').click({position:{x:100,y:100}});
  await expect(host).toHaveAttribute('data-selected-poi','alchemy-circle');
  expect(await page.evaluate(() => (window as unknown as { selections:unknown[] }).selections)).toEqual([]);
  expect(await camera(page)).toEqual(state);
  expect(page.url()).toBe(url);
  await markers.click();
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('Alchemy Circle');
  await markers.click();
  await rotate.click();
  await page.getByRole('button',{name:'Reset view',exact:true}).click();
  await expect(markers).toHaveAttribute('aria-pressed','false');
  await expect(rotate).toHaveAttribute('aria-pressed','false');
  await expect(preview).toBeHidden();
  await expect(host).toHaveAttribute('data-selected-poi','alchemy-circle');
  expect(await page.locator('a[data-poi-slug]').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-poi-slug')))).toEqual(list);
  await rotate.click();
  await page.locator('[data-map-locate="alchemy-circle"]').click();
  await expect(markers).toHaveAttribute('aria-pressed','true');
  await expect(rotate).toHaveAttribute('aria-pressed','false');
  await expect(preview).toBeFocused();
  expect(page.url()).toBe(url);
});

test('keyboard wraps full turns, clamps both tilt limits, wheel retains angle, reset is baseline-identical', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('[data-map-enhancement]')).toHaveAttribute('data-webgl','ready');
  const initial = await camera(page);
  const rotate = page.getByRole('button',{name:'Rotate map',exact:true});
  await rotate.focus();
  for (let n=0;n<25;n++) await page.keyboard.press('ArrowLeft');
  for (let n=0;n<10;n++) await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await camera(page)).yawDegrees).toBe(30);
  await expect.poll(async () => (await camera(page)).pitchDegrees).toBe(89.9);
  await page.locator('canvas').hover();
  await page.mouse.wheel(0,-100);
  await expect.poll(async () => (await camera(page)).distance).toBeLessThan(initial.distance);
  expect((await camera(page)).yawDegrees).toBe(30);
  expect((await camera(page)).pitchDegrees).toBe(89.9);
  await rotate.focus();
  for (let n=0;n<10;n++) await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await camera(page)).pitchDegrees).toBe(15);
  await page.setViewportSize({width:390,height:844});
  await expect.poll(async () => (await camera(page)).pitchDegrees).toBe(15);
  await expect.poll(async () => (await camera(page)).yawDegrees).toBe(30);
  expect(Object.values(await camera(page)).every(Number.isFinite)).toBe(true);
  await page.getByRole('button',{name:'Reset view',exact:true}).click();
  await expect.poll(async () => (await camera(page)).pitchDegrees).toBe(30);
  await expect.poll(async () => (await camera(page)).yawDegrees).toBe(45);
  await page.setViewportSize({width:1280,height:720});
  await expect.poll(() => camera(page)).toEqual(initial);
});

test('unavailable WebGL disables new controls while retaining semantic category links', async ({page}) => {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type:string,...args:unknown[]) { return /^webgl/.test(type) ? null : Reflect.apply(get,this,[type,...args]); } as typeof get;
  });
  await page.goto('/categories/stages/');
  await expect(page.locator('[data-map-enhancement]')).toHaveAttribute('data-webgl','unavailable');
  await expect(page.getByRole('button',{name:'Show markers',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Rotate map',exact:true})).toBeDisabled();
  await expect(page.locator('canvas')).toBeHidden();
  await page.locator('a[data-poi-slug="alchemy-circle"]').click();
  await expect(page).toHaveURL(/\/poi\/boom-2025\/alchemy-circle\/$/);
});
