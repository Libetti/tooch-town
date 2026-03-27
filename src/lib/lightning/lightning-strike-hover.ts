import { type Map as MapLibreMap } from 'maplibre-gl';
import maplibregl from 'maplibre-gl';

type HoverableLightningFeature = {
	geometry?: {
		type?: string;
		coordinates?: unknown;
	};
	properties?: Record<string, unknown>;
};

type MapWithOptionalCanvas = MapLibreMap & {
	getCanvas?: () => { style?: { cursor: string } };
};
type QueryRenderedFeaturesTarget = Parameters<MapLibreMap['queryRenderedFeatures']>[0];
type PointLike = { x?: unknown; y?: unknown };

const strikeTimeFormatter = new Intl.DateTimeFormat(undefined, {
	year: 'numeric',
	month: 'short',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	hour12: true,
	timeZone: 'UTC',
	timeZoneName: 'short'
});

const formatStrikeTime = (timeRaw: unknown): string => {
	if (typeof timeRaw !== 'string' || timeRaw.trim().length === 0) return 'Unknown';
	const timeMs = Date.parse(timeRaw);
	if (!Number.isFinite(timeMs)) return timeRaw;
	return strikeTimeFormatter.format(new Date(timeMs));
};

const formatIntensity = (energyRaw: unknown): string => {
	if (typeof energyRaw !== 'number' || !Number.isFinite(energyRaw)) return 'Unknown';
	if (energyRaw < 1e-14) return 'Very Weak';
	if (energyRaw < 1e-13) return 'Weak';
	if (energyRaw < 1e-12) return 'Moderate';
	if (energyRaw < 1e-11) return 'Strong';
	return 'Severe';
};

const escapeHtml = (value: string): string =>
	value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');

const popupMarkup = (feature: HoverableLightningFeature): string => {
	const properties = feature.properties ?? {};
	const id =
		typeof properties.id === 'string' && properties.id.trim().length > 0
			? properties.id
			: 'Unknown';
	const satellite =
		typeof properties.satellite === 'string' && properties.satellite.trim().length > 0
			? properties.satellite
			: 'Unknown';

	return [
		`ID: ${escapeHtml(id)}`,
		`Satellite: ${escapeHtml(satellite)}`,
		`Time: ${escapeHtml(formatStrikeTime(properties.time))}`,
		`Intensity: ${escapeHtml(formatIntensity(properties.energy))}`
	].join('<br/>');
};

const getFeatureCoordinates = (
	feature: HoverableLightningFeature
): [number, number] | undefined => {
	const geometry = feature.geometry;
	if (!geometry || geometry.type !== 'Point' || !Array.isArray(geometry.coordinates))
		return undefined;
	const [lng, lat] = geometry.coordinates;
	if (typeof lng !== 'number' || typeof lat !== 'number') return undefined;
	if (!Number.isFinite(lng) || !Number.isFinite(lat)) return undefined;
	return [lng, lat];
};

const setCursor = (map: MapLibreMap | undefined, cursor: string): void => {
	if (!map) return;
	const mapWithCanvas = map as MapWithOptionalCanvas;
	const canvasStyle = mapWithCanvas.getCanvas?.().style;
	if (canvasStyle) canvasStyle.cursor = cursor;
};

const HOVER_HIT_PADDING_PX = 6;

type LightningStrikeHoverController = {
	attach: (map: MapLibreMap) => void;
	detach: () => void;
};

type LightningStrikeHoverOptions = {
	layerId: string;
};

export const createLightningStrikeHoverController = ({
	layerId
}: LightningStrikeHoverOptions): LightningStrikeHoverController => {
	let mapRef: MapLibreMap | undefined;
	let pointerMoveHandler: ((event: unknown) => void) | undefined;
	let pointerLeaveHandler: (() => void) | undefined;
	let hoverPopup: maplibregl.Popup | undefined;
	let activeFeatureKey: string | undefined;
	let cursorIsPointer = false;

	const setPointerCursor = (): void => {
		if (cursorIsPointer) return;
		setCursor(mapRef, 'pointer');
		cursorIsPointer = true;
	};

	const clearPointerCursor = (): void => {
		if (!cursorIsPointer) return;
		setCursor(mapRef, '');
		cursorIsPointer = false;
	};

	const resetHoverState = (): void => {
		clearPointerCursor();
		if (!hoverPopup) {
			activeFeatureKey = undefined;
			return;
		}
		hoverPopup.remove();
		activeFeatureKey = undefined;
	};

	const ensurePopup = (): maplibregl.Popup => {
		if (!hoverPopup) {
			hoverPopup = new maplibregl.Popup({
				closeButton: false,
				closeOnClick: false,
				offset: 8,
				className: 'lightning-strike-popup'
			});
		}
		return hoverPopup;
	};

	const toHitTarget = (point: unknown): QueryRenderedFeaturesTarget => {
		const pointLike = point as PointLike;
		if (
			typeof pointLike.x !== 'number' ||
			!Number.isFinite(pointLike.x) ||
			typeof pointLike.y !== 'number' ||
			!Number.isFinite(pointLike.y)
		) {
			return point as QueryRenderedFeaturesTarget;
		}
		return [
			[pointLike.x - HOVER_HIT_PADDING_PX, pointLike.y - HOVER_HIT_PADDING_PX],
			[pointLike.x + HOVER_HIT_PADDING_PX, pointLike.y + HOVER_HIT_PADDING_PX]
		] as QueryRenderedFeaturesTarget;
	};

	const featureKey = (
		feature: HoverableLightningFeature,
		coordinates: [number, number]
	): string => {
		const id =
			typeof feature.properties?.id === 'string' && feature.properties.id.trim().length > 0
				? feature.properties.id
				: 'unknown';
		return `${id}:${coordinates[0]}:${coordinates[1]}`;
	};

	const detach = (): void => {
		if (!mapRef) return;
		if (pointerMoveHandler) mapRef.off('mousemove', pointerMoveHandler);
		if (pointerLeaveHandler) mapRef.off('mouseleave', pointerLeaveHandler);
		pointerMoveHandler = undefined;
		pointerLeaveHandler = undefined;
		resetHoverState();
		mapRef = undefined;
	};

	const attach = (map: MapLibreMap): void => {
		if (mapRef === map && pointerMoveHandler && pointerLeaveHandler) return;
		detach();
		mapRef = map;

		pointerMoveHandler = (event: unknown) => {
			if (!mapRef || !mapRef.getLayer(layerId)) {
				resetHoverState();
				return;
			}
			const mapEvent = event as { point?: unknown };
			if (!mapEvent.point) {
				resetHoverState();
				return;
			}
			const features = mapRef.queryRenderedFeatures(toHitTarget(mapEvent.point), {
				layers: [layerId]
			}) as unknown as HoverableLightningFeature[];
			const feature = features[0];
			if (!feature) {
				resetHoverState();
				return;
			}
			const coordinates = getFeatureCoordinates(feature);
			if (!coordinates) {
				resetHoverState();
				return;
			}

			const nextFeatureKey = featureKey(feature, coordinates);
			setPointerCursor();

			// Avoid redundant popup DOM writes while hovering the same strike.
			if (nextFeatureKey === activeFeatureKey && hoverPopup) {
				return;
			}

			const popup = ensurePopup();
			popup.setLngLat(coordinates).setHTML(popupMarkup(feature)).addTo(mapRef);
			popup.getElement().style.pointerEvents = 'none';
			activeFeatureKey = nextFeatureKey;
		};

		pointerLeaveHandler = () => {
			resetHoverState();
		};

		mapRef.on('mousemove', pointerMoveHandler);
		mapRef.on('mouseleave', pointerLeaveHandler);
	};

	return {
		attach,
		detach
	};
};
