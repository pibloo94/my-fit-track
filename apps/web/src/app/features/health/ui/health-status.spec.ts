import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { HealthStatus } from './health-status';

describe('HealthStatus', () => {
  it('renders the snapshot and does not fetch anything itself', async () => {
    TestBed.configureTestingModule({
      imports: [HealthStatus],
      providers: [provideZonelessChangeDetection()],
    });

    const fixture = TestBed.createComponent(HealthStatus);
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('snapshot', {
      status: 'ok',
      version: 'test-1.0.0',
      uptimeSeconds: 9,
      checkedAt: new Date('2026-08-23T18:00:00.000Z'),
    });
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    const text = host.textContent ?? '';
    expect(text).toContain('ok');
    expect(text).toContain('test-1.0.0');
    expect(text).toContain('9s');
    expect(host.querySelector('[data-testid="health-ok"]')).not.toBeNull();
  });

  it('shows the AppError title, not a raw HTTP status', async () => {
    TestBed.configureTestingModule({
      imports: [HealthStatus],
      providers: [provideZonelessChangeDetection()],
    });

    const fixture = TestBed.createComponent(HealthStatus);
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('error', {
      code: 'NOT_FOUND',
      title: 'Not found',
      status: 404,
      traceId: 'trace-ui',
    });
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Not found');
    expect(text).toContain('trace-ui');
    expect(text).not.toContain('Http failure');
  });
});
