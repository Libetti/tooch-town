import type { Map as MapLibreMap } from 'maplibre-gl';
import { describe, expect, it, vi } from 'vitest';
import { applyMapTilerWeatherMapShim } from './maptiler-weather-map-shim';

type ShimmedMap = MapLibreMap & {
	getSdkConfig?: () => { apiKey: string };
	getMaptilerSessionId?: () => string;
	isGlobeProjection?: () => boolean;
	telemetry?: {
		registerModule?: (name: string, version: string) => void;
	};
};

const createMockMap = (projectionType: string = 'globe'): ShimmedMap => {
	const map = {
		getProjection: vi.fn(() => ({ type: projectionType })),
		getSdkConfig: undefined,
		getMaptilerSessionId: undefined,
		isGlobeProjection: undefined,
		telemetry: undefined
	};
	return map as unknown as ShimmedMap;
};

describe('applyMapTilerWeatherMapShim', () => {
	it('adds required MapTiler SDK-like methods and telemetry for weather layers', () => {
		const map = createMockMap('globe');

		applyMapTilerWeatherMapShim(map, 'abc123');

		expect(map.getSdkConfig?.().apiKey).toBe('abc123');
		const sessionA = map.getMaptilerSessionId?.();
		const sessionB = map.getMaptilerSessionId?.();
		expect(sessionA).toBeTruthy();
		expect(sessionA).toBe(sessionB);
		expect(map.isGlobeProjection?.()).toBe(true);

		expect(typeof map.telemetry?.registerModule).toBe('function');
		expect(() => map.telemetry?.registerModule?.('weather', '1.0.0')).not.toThrow();
	});

	it('does not overwrite existing methods or telemetry', () => {
		const existingGetSdkConfig = vi.fn(() => ({ apiKey: 'existing-key' }));
		const existingGetSession = vi.fn(() => 'existing-session');
		const existingIsGlobeProjection = vi.fn(() => false);
		const existingRegisterModule = vi.fn();

		const map = createMockMap('mercator');
		map.getSdkConfig = existingGetSdkConfig;
		map.getMaptilerSessionId = existingGetSession;
		map.isGlobeProjection = existingIsGlobeProjection;
		map.telemetry = { registerModule: existingRegisterModule };

		applyMapTilerWeatherMapShim(map, 'new-key');

		expect(map.getSdkConfig).toBe(existingGetSdkConfig);
		expect(map.getMaptilerSessionId).toBe(existingGetSession);
		expect(map.isGlobeProjection).toBe(existingIsGlobeProjection);
		expect(map.telemetry?.registerModule).toBe(existingRegisterModule);
	});
});
