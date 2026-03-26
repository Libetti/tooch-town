import type { Map } from 'maplibre-gl';

// Compatibility shim:
// `@maptiler/weather` expects a MapTiler SDK map shape, but this project uses MapLibre directly.
// We only provide the minimum SDK-like surface that weather layers touch at runtime.
type MapTilerSdkConfig = {
	apiKey: string;
};

type MapWithWeatherShim = Map & {
	getSdkConfig?: () => MapTilerSdkConfig;
	getMaptilerSessionId?: () => string;
	isGlobeProjection?: () => boolean;
	telemetry?: {
		registerModule?: (name: string, version: string) => void;
	};
};

const createSessionId = (): string => {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `weather-session-${Date.now()}`;
};

export const applyMapTilerWeatherMapShim = (targetMap: Map, apiKey: string): void => {
	const map = targetMap as MapWithWeatherShim;

	if (!map.getSdkConfig) {
		map.getSdkConfig = () => ({ apiKey });
	}
	if (!map.getMaptilerSessionId) {
		const sessionId = createSessionId();
		map.getMaptilerSessionId = () => sessionId;
	}
	if (!map.isGlobeProjection) {
		map.isGlobeProjection = () => {
			const projection = targetMap.getProjection?.();
			return projection?.type === 'globe';
		};
	}
	if (!map.telemetry) {
		map.telemetry = {
			registerModule: () => {}
		};
	} else if (!map.telemetry.registerModule) {
		map.telemetry.registerModule = () => {};
	}
};
