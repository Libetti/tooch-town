import { PrecipitationLayer } from '@maptiler/weather';
import type { LayerSpecification, Map } from 'maplibre-gl';

type PrecipitationLayerSyncInput = {
	visible: boolean;
};

type PrecipitationLayerManager = {
	sync: (targetMap: Map, input: PrecipitationLayerSyncInput) => void;
	clear: (targetMap: Map) => void;
	resetAppliedState: () => void;
};

type PrecipitationLayerManagerOptions = {
	layerId?: string;
	beforeLayerId?: string;
	animationFactor?: number;
};

const applyMapLibreAsyncOnAddGuard = (weatherLayer: PrecipitationLayer): void => {
	const layer = weatherLayer as PrecipitationLayer & {
		onAdd?: (...args: unknown[]) => unknown;
		prerender?: (...args: unknown[]) => unknown;
		render?: (...args: unknown[]) => unknown;
	};

	const originalOnAdd = layer.onAdd?.bind(layer);
	const originalPrerender = layer.prerender?.bind(layer);
	const originalRender = layer.render?.bind(layer);
	if (!originalOnAdd || !originalPrerender || !originalRender) return;

	let ready = false;
	let failed = false;

	layer.onAdd = (...args: unknown[]) => {
		void Promise.resolve(originalOnAdd(...args))
			.then(() => {
				ready = true;
			})
			.catch(() => {
				failed = true;
			});
	};

	layer.prerender = (...args: unknown[]) => {
		if (!ready || failed) return;
		return originalPrerender(...args);
	};

	layer.render = (...args: unknown[]) => {
		if (!ready || failed) return;
		return originalRender(...args);
	};
};

export const createPrecipitationLayerManager = ({
	layerId = 'weather-precipitation',
	beforeLayerId,
	animationFactor = 3600
}: PrecipitationLayerManagerOptions = {}): PrecipitationLayerManager => {
	let appliedVisible: boolean | undefined;
	let layer: PrecipitationLayer | undefined;
	let syncVersion = 0;

	const removeLayerArtifacts = (targetMap: Map): void => {
		if (targetMap.getLayer(layerId)) {
			targetMap.removeLayer(layerId);
		}
		layer = undefined;
	};

	const resetAppliedState = (): void => {
		appliedVisible = undefined;
	};

	const sync = (targetMap: Map, input: PrecipitationLayerSyncInput): void => {
		const { visible } = input;
		if (!targetMap.isStyleLoaded()) return;

		if (appliedVisible === visible && (!visible || targetMap.getLayer(layerId) !== undefined)) {
			return;
		}

		syncVersion += 1;
		const currentSyncVersion = syncVersion;

		if (!visible) {
			layer?.animate(0);
			removeLayerArtifacts(targetMap);
			appliedVisible = visible;
			return;
		}

		const beforeId =
			beforeLayerId && targetMap.getLayer(beforeLayerId) ? beforeLayerId : undefined;
		const createdLayer = new PrecipitationLayer({ id: layerId });
		applyMapLibreAsyncOnAddGuard(createdLayer);
		layer = createdLayer;
		targetMap.addLayer(createdLayer as unknown as LayerSpecification, beforeId);
		appliedVisible = visible;

		void (async () => {
			try {
				await createdLayer.onSourceReadyAsync();
				if (syncVersion !== currentSyncVersion || layer !== createdLayer) return;
				createdLayer.animateByFactor(animationFactor);
			} catch {
				// Keep this manager best-effort and avoid bubbling errors into map lifecycle.
			}
		})();
	};

	const clear = (targetMap: Map): void => {
		syncVersion += 1;
		layer?.animate(0);
		removeLayerArtifacts(targetMap);
		resetAppliedState();
	};

	return {
		sync,
		clear,
		resetAppliedState
	};
};
