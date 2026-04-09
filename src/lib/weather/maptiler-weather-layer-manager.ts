import type { LayerSpecification, Map } from 'maplibre-gl';

type MapTilerWeatherLayer = {
	id: string;
	animate: (factor: number) => void;
	onSourceReadyAsync: () => Promise<void>;
	getAnimationEndDate?: () => Date;
	setAnimationTime?: (time: number) => void;
};

type MapTilerWeatherLayerCtor = new (options?: { id?: string }) => MapTilerWeatherLayer;

type MapLibreLayerLifecycle = {
	onAdd?: (...args: unknown[]) => unknown;
	prerender?: (...args: unknown[]) => unknown;
	render?: (...args: unknown[]) => unknown;
};

type MapTilerWeatherLayerSyncInput = {
	visible: boolean;
	time?: Date | number;
};

type MapTilerWeatherLayerManager = {
	sync: (targetMap: Map, input: MapTilerWeatherLayerSyncInput) => void;
	clear: (targetMap: Map) => void;
	resetAppliedState: () => void;
	getAnimationEndDate: () => Date | undefined;
};

type MapTilerWeatherLayerManagerOptions = {
	layerId: string;
	layerCtor: MapTilerWeatherLayerCtor;
	beforeLayerId?: string | string[];
};

const resolveBeforeLayerId = (
	targetMap: Map,
	beforeLayerId: string | string[] | undefined
): string | undefined => {
	if (!beforeLayerId) return undefined;

	const candidateIds = Array.isArray(beforeLayerId) ? beforeLayerId : [beforeLayerId];
	return candidateIds.find((candidateId) => targetMap.getLayer(candidateId)) ?? undefined;
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
	beforeLayerId
}: MapTilerWeatherLayerManagerOptions): MapTilerWeatherLayerManager => {
	let appliedVisible: boolean | undefined;
	let appliedTimeMs: number | undefined;
	let layer: MapTilerWeatherLayer | undefined;
	let syncVersion = 0;
	let layerReady = false;

	const removeLayerArtifacts = (targetMap: Map): void => {
		if (targetMap.getLayer(layerId)) {
			targetMap.removeLayer(layerId);
		}
		layer = undefined;
		layerReady = false;
	};

	const resetAppliedState = (): void => {
		appliedVisible = undefined;
		appliedTimeMs = undefined;
	};

	const normalizeTime = (value: Date | number | undefined): number | undefined => {
		if (value instanceof Date) return value.getTime();
		if (typeof value === 'number' && Number.isFinite(value)) return value;
		return undefined;
	};

	const applyLayerTime = (targetTimeMs: number | undefined): void => {
		if (!layerReady || !layer) return;
		layer.animate(0);
		if (targetTimeMs !== undefined) layer.setAnimationTime?.(targetTimeMs);
	};

	const sync = (targetMap: Map, input: MapTilerWeatherLayerSyncInput): void => {
		const { visible } = input;
		const timeMs = normalizeTime(input.time);
		if (!targetMap.isStyleLoaded()) return;

		if (
			appliedVisible === visible &&
			appliedTimeMs === timeMs &&
			(!visible || targetMap.getLayer(layerId) !== undefined)
		) {
			return;
		}

		if (!visible) {
			layer?.animate(0);
			removeLayerArtifacts(targetMap);
			appliedVisible = visible;
			appliedTimeMs = timeMs;
			return;
		}

		if (layer && targetMap.getLayer(layerId)) {
			appliedVisible = visible;
			appliedTimeMs = timeMs;
			applyLayerTime(timeMs);
			return;
		}

		syncVersion += 1;
		const currentSyncVersion = syncVersion;
		const beforeId = resolveBeforeLayerId(targetMap, beforeLayerId);
		const createdLayer = new layerCtor({ id: layerId });
		applyMapLibreAsyncOnAddGuard(createdLayer);
		layer = createdLayer;
		layerReady = false;
		targetMap.addLayer(createdLayer as unknown as LayerSpecification, beforeId);
		appliedVisible = visible;
		appliedTimeMs = timeMs;

		void (async () => {
			try {
				await createdLayer.onSourceReadyAsync();
				if (syncVersion !== currentSyncVersion || layer !== createdLayer) return;
				layerReady = true;
				applyLayerTime(appliedTimeMs);
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

	const getAnimationEndDate = (): Date | undefined => {
		if (!layer?.getAnimationEndDate) return undefined;
		const animationEndDate = layer.getAnimationEndDate();
		return Number.isFinite(animationEndDate.getTime()) ? animationEndDate : undefined;
	};

	return {
		sync,
		clear,
		resetAppliedState,
		getAnimationEndDate
	};
};
