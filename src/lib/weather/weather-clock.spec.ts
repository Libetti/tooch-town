import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWeatherClockController } from './weather-clock';

describe('createWeatherClockController', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-16T00:00:00.000Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('initializes with the provided time', () => {
		const controller = createWeatherClockController(new Date('2026-03-16T03:00:00.000Z'));

		expect(controller.getSnapshot().currentTime.toISOString()).toBe('2026-03-16T03:00:00.000Z');
		expect(controller.getSnapshot().minTime.toISOString()).toBe('2026-03-16T03:00:00.000Z');
		expect(controller.getSnapshot().maxTime.toISOString()).toBe('2026-03-16T03:00:00.000Z');
		expect(controller.getSnapshot().playing).toBe(false);
	});

	it('updates the active time within the configured range', () => {
		const controller = createWeatherClockController(new Date('2026-03-16T03:00:00.000Z'));
		controller.setRange({
			min: new Date('2026-03-16T03:00:00.000Z'),
			max: new Date('2026-03-16T05:00:00.000Z')
		});

		controller.setTime(new Date('2026-03-16T05:00:00.000Z'));
		expect(controller.getSnapshot().currentTime.toISOString()).toBe('2026-03-16T05:00:00.000Z');

		controller.setTime(new Date('2026-03-16T00:00:00.000Z'));
		expect(controller.getSnapshot().currentTime.toISOString()).toBe('2026-03-16T03:00:00.000Z');
	});

	it('jumps to the freshest available now reference', () => {
		const controller = createWeatherClockController(new Date('2026-03-16T03:00:00.000Z'));
		controller.setRange({
			min: new Date('2026-03-16T03:00:00.000Z'),
			max: new Date('2026-03-16T12:00:00.000Z')
		});

		controller.setNowReference(new Date('2026-03-16T08:00:00.000Z'));
		controller.jumpToNow();

		expect(controller.getSnapshot().currentTime.toISOString()).toBe('2026-03-16T08:00:00.000Z');
	});

	it('autoplays by one hour per second while playing', () => {
		const controller = createWeatherClockController(new Date('2026-03-16T03:00:00.000Z'));
		controller.setRange({
			min: new Date('2026-03-16T03:00:00.000Z'),
			max: new Date('2026-03-16T05:00:00.000Z')
		});

		controller.play();
		vi.advanceTimersByTime(2_000);

		expect(controller.getSnapshot().playing).toBe(false);
		expect(controller.getSnapshot().currentTime.toISOString()).toBe('2026-03-16T05:00:00.000Z');

		controller.pause();
		vi.advanceTimersByTime(2_000);
		expect(controller.getSnapshot().currentTime.toISOString()).toBe('2026-03-16T05:00:00.000Z');
	});

	it('clamps direct time updates into the active range', () => {
		const controller = createWeatherClockController(new Date('2026-03-16T03:00:00.000Z'));
		controller.setRange({
			min: new Date('2026-03-16T03:00:00.000Z'),
			max: new Date('2026-03-16T05:00:00.000Z')
		});

		controller.setTime(new Date('2026-03-16T10:00:00.000Z'));
		expect(controller.getSnapshot().currentTime.toISOString()).toBe('2026-03-16T05:00:00.000Z');
	});
});
