import { describe, it, expect, vi } from 'vitest';
import { executeStep } from '../../src/recorder/executor.js';

function mockLocator() {
  const loc: any = {
    first: vi.fn(() => loc),
    click: vi.fn(),
    fill: vi.fn(),
    hover: vi.fn(),
    waitFor: vi.fn(),
    pressSequentially: vi.fn(),
    boundingBox: vi.fn().mockResolvedValue(null),
  };
  return loc;
}

function mockPage() {
  const loc = mockLocator();
  return {
    goto: vi.fn(),
    click: vi.fn(),
    fill: vi.fn(),
    hover: vi.fn(),
    evaluate: vi.fn(),
    waitForTimeout: vi.fn(),
    waitForSelector: vi.fn(),
    screenshot: vi.fn(),
    keyboard: { press: vi.fn() },
    locator: vi.fn(() => loc),
    mouse: { move: vi.fn() },
    _locator: loc,
  };
}

describe('executeStep', () => {
  it('executes navigate step', async () => {
    const page = mockPage();
    await executeStep(page as any, { action: 'navigate', url: 'https://example.com' });
    expect(page.goto).toHaveBeenCalledWith('https://example.com', expect.any(Object));
  });

  it('executes click step', async () => {
    const page = mockPage();
    await executeStep(page as any, { action: 'click', selector: '#btn' });
    expect(page.locator).toHaveBeenCalledWith('#btn');
    expect(page._locator.first).toHaveBeenCalled();
    expect(page._locator.click).toHaveBeenCalledWith(expect.any(Object));
  });

  it('executes fill step with typing animation', async () => {
    const page = mockPage();
    await executeStep(page as any, { action: 'fill', selector: '#input', value: 'hello' });
    expect(page.locator).toHaveBeenCalledWith('#input');
    expect(page._locator.click).toHaveBeenCalled();
    expect(page._locator.pressSequentially).toHaveBeenCalledWith('hello', { delay: 60 });
  });

  it('executes scroll step', async () => {
    const page = mockPage();
    await executeStep(page as any, { action: 'scroll', y: 400 });
    expect(page.evaluate).toHaveBeenCalled();
  });

  it('executes press step', async () => {
    const page = mockPage();
    await executeStep(page as any, { action: 'press', key: 'Enter' });
    expect(page.keyboard.press).toHaveBeenCalledWith('Enter');
  });

  it('fixes mixed css/text selectors', async () => {
    const page = mockPage();
    await executeStep(page as any, { action: 'click', selector: '[role="dialog"] text=Submit' });
    expect(page.locator).toHaveBeenCalledWith('[role="dialog"] >> text=Submit');
  });
});
