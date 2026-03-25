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

		syncVersion += 1;
		const currentSyncVersion = syncVersion;

		if (appliedVisible === visible && (!visible || targetMap.getLayer(layerId) !== undefined)) {
			return;
		}

		if (!visible) {
			layer?.animate(0);
			removeLayerArtifacts(targetMap);
			appliedVisible = visible;
			return;
		}

		const beforeId =
			beforeLayerId && targetMap.getLayer(beforeLayerId) ? beforeLayerId : undefined;
		const createdLayer = new PrecipitationLayer({ id: layerId });
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
