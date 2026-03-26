import type { LayerSpecification, Map } from 'maplibre-gl';

type MapTilerWeatherLayer = {
	id: string;
	animate: (factor: number) => void;
	animateByFactor: (factor: number) => void;
	onSourceReadyAsync: () => Promise<void>;
};

type MapTilerWeatherLayerCtor = new (options?: { id?: string }) => MapTilerWeatherLayer;

type MapLibreLayerLifecycle = {
	onAdd?: (...args: unknown[]) => unknown;
	prerender?: (...args: unknown[]) => unknown;
	render?: (...args: unknown[]) => unknown;
};

type MapTilerWeatherLayerSyncInput = {
	visible: boolean;
};

type MapTilerWeatherLayerManager = {
	sync: (targetMap: Map, input: MapTilerWeatherLayerSyncInput) => void;
	clear: (targetMap: Map) => void;
	resetAppliedState: () => void;
};

type MapTilerWeatherLayerManagerOptions = {
	layerId: string;
	layerCtor: MapTilerWeatherLayerCtor;
	beforeLayerId?: string;
	animationFactor?: number;
};

const applyMapLibreAsyncOnAddGuard = (layer: MapTilerWeatherLayer): void => {
	const layerWithLifecycle = layer as MapTilerWeatherLayer & MapLibreLayerLifecycle;
	const originalOnAdd = layerWithLifecycle.onAdd?.bind(layer);
	const originalPrerender = layerWithLifecycle.prerender?.bind(layer);
	const originalRender = layerWithLifecycle.render?.bind(layer);
	if (!originalOnAdd || !originalPrerender || !originalRender) return;

	let ready = false;
	let failed = false;

	layerWithLifecycle.onAdd = (...args: unknown[]) => {
		void Promise.resolve(originalOnAdd(...args))
			.then(() => {
				ready = true;
			})
			.catch(() => {
				failed = true;
			});
	};

	layerWithLifecycle.prerender = (...args: unknown[]) => {
		if (!ready || failed) return;
		return originalPrerender(...args);
	};

	layerWithLifecycle.render = (...args: unknown[]) => {
		if (!ready || failed) return;
		return originalRender(...args);
	};
};

export const createMapTilerWeatherLayerManager = ({
	layerId,
	layerCtor,
	beforeLayerId,
	animationFactor = 3600
}: MapTilerWeatherLayerManagerOptions): MapTilerWeatherLayerManager => {
	let appliedVisible: boolean | undefined;
	let layer: MapTilerWeatherLayer | undefined;
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

	const sync = (targetMap: Map, input: MapTilerWeatherLayerSyncInput): void => {
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
		const createdLayer = new layerCtor({ id: layerId });
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
