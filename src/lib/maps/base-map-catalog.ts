import type { StyleSpecification } from 'maplibre-gl';
import { BASE_LAYER_IDS, type BaseLayerId } from '$lib/maps/base-layer-ids';
import type { BaseMapOption } from '$lib/layers/layer-registry';

type BaseMapCatalogEntry = {
	id: BaseLayerId;
	label: string;
	maptilerStyleId?: string;
	fallbackStyle: StyleSpecification;
};

const FALLBACK_STREETS_STYLE: StyleSpecification = {
	version: 8,
	sources: {
		osm: {
			type: 'raster',
			tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
			tileSize: 256,
			attribution: '© OpenStreetMap contributors'
		}
	},
	layers: [{ id: 'osm-base', type: 'raster', source: 'osm' }]
};

const FALLBACK_SATELLITE_STYLE: StyleSpecification = {
	version: 8,
	sources: {
		esriSatellite: {
			type: 'raster',
			tiles: [
				'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
			],
			tileSize: 256,
			attribution: 'Source: Esri, Maxar, Earthstar Geographics, and the GIS user community'
		}
	},
	layers: [{ id: 'esri-satellite-base', type: 'raster', source: 'esriSatellite' }]
};

const STREETS_FALLBACK = FALLBACK_STREETS_STYLE;
const SATELLITE_FALLBACK = FALLBACK_SATELLITE_STYLE;

const assertCatalogCoverage = <
	T extends readonly BaseMapCatalogEntry[],
	Missing extends Exclude<BaseLayerId, T[number]['id']> = Exclude<BaseLayerId, T[number]['id']>
>(
	catalog: Missing extends never ? T : never
): T => catalog;

const MAPTILER_BASE_MAPS = assertCatalogCoverage([
	{ id: 'satellite', label: 'Satellite', maptilerStyleId: 'satellite', fallbackStyle: SATELLITE_FALLBACK },
	{ id: 'hybrid', label: 'Hybrid', maptilerStyleId: 'hybrid', fallbackStyle: SATELLITE_FALLBACK },
	{ id: 'streets', label: 'Streets', maptilerStyleId: 'streets', fallbackStyle: STREETS_FALLBACK },
	{ id: 'streets-v2', label: 'Streets V2', maptilerStyleId: 'streets-v2', fallbackStyle: STREETS_FALLBACK },
	{
		id: 'streets-v2-dark',
		label: 'Streets Dark',
		maptilerStyleId: 'streets-v2-dark',
		fallbackStyle: STREETS_FALLBACK
	},
	{
		id: 'streets-v2-light',
		label: 'Streets Light',
		maptilerStyleId: 'streets-v2-light',
		fallbackStyle: STREETS_FALLBACK
	},
	{
		id: 'streets-v2-night',
		label: 'Streets Night',
		maptilerStyleId: 'streets-v2-night',
		fallbackStyle: STREETS_FALLBACK
	},
	{
		id: 'streets-v2-pastel',
		label: 'Streets Pastel',
		maptilerStyleId: 'streets-v2-pastel',
		fallbackStyle: STREETS_FALLBACK
	},
	{ id: 'outdoor-v2', label: 'Outdoor', maptilerStyleId: 'outdoor-v2', fallbackStyle: STREETS_FALLBACK },
	{
		id: 'outdoor-v2-dark',
		label: 'Outdoor Dark',
		maptilerStyleId: 'outdoor-v2-dark',
		fallbackStyle: STREETS_FALLBACK
	},
	{ id: 'winter-v2', label: 'Winter', maptilerStyleId: 'winter-v2', fallbackStyle: STREETS_FALLBACK },
	{
		id: 'winter-v2-dark',
		label: 'Winter Dark',
		maptilerStyleId: 'winter-v2-dark',
		fallbackStyle: STREETS_FALLBACK
	},
	{ id: 'basic-v2', label: 'Basic', maptilerStyleId: 'basic-v2', fallbackStyle: STREETS_FALLBACK },
	{
		id: 'basic-v2-dark',
		label: 'Basic Dark',
		maptilerStyleId: 'basic-v2-dark',
		fallbackStyle: STREETS_FALLBACK
	},
	{
		id: 'basic-v2-light',
		label: 'Basic Light',
		maptilerStyleId: 'basic-v2-light',
		fallbackStyle: STREETS_FALLBACK
	},
	{ id: 'bright-v2', label: 'Bright', maptilerStyleId: 'bright-v2', fallbackStyle: STREETS_FALLBACK },
	{
		id: 'bright-v2-dark',
		label: 'Bright Dark',
		maptilerStyleId: 'bright-v2-dark',
		fallbackStyle: STREETS_FALLBACK
	},
	{
		id: 'bright-v2-light',
		label: 'Bright Light',
		maptilerStyleId: 'bright-v2-light',
		fallbackStyle: STREETS_FALLBACK
	},
	{
		id: 'bright-v2-pastel',
		label: 'Bright Pastel',
		maptilerStyleId: 'bright-v2-pastel',
		fallbackStyle: STREETS_FALLBACK
	},
	{
		id: 'topo-v2',
		label: 'Topographic',
		maptilerStyleId: 'topo-v2',
		fallbackStyle: STREETS_FALLBACK
	},
	{
		id: 'topo-v2-shiny',
		label: 'Topographic Shiny',
		maptilerStyleId: 'topo-v2-shiny',
		fallbackStyle: STREETS_FALLBACK
	},
	{
		id: 'topo-v2-pastel',
		label: 'Topographic Pastel',
		maptilerStyleId: 'topo-v2-pastel',
		fallbackStyle: STREETS_FALLBACK
	},
	{
		id: 'topo-v2-topographique',
		label: 'Topographique',
		maptilerStyleId: 'topo-v2-topographique',
		fallbackStyle: STREETS_FALLBACK
	},
	{ id: 'voyager-v2', label: 'Voyager', maptilerStyleId: 'voyager-v2', fallbackStyle: STREETS_FALLBACK },
	{
		id: 'voyager-v2-darkmatter',
		label: 'Voyager Dark',
		maptilerStyleId: 'voyager-v2-darkmatter',
		fallbackStyle: STREETS_FALLBACK
	},
	{
		id: 'voyager-v2-positron',
		label: 'Voyager Light',
		maptilerStyleId: 'voyager-v2-positron',
		fallbackStyle: STREETS_FALLBACK
	},
	{
		id: 'voyager-v2-vintage',
		label: 'Voyager Vintage',
		maptilerStyleId: 'voyager-v2-vintage',
		fallbackStyle: STREETS_FALLBACK
	},
	{ id: 'toner-v2', label: 'Toner', maptilerStyleId: 'toner-v2', fallbackStyle: STREETS_FALLBACK },
	{
		id: 'toner-v2-background',
		label: 'Toner Background',
		maptilerStyleId: 'toner-v2-background',
		fallbackStyle: STREETS_FALLBACK
	},
	{
		id: 'toner-v2-lite',
		label: 'Toner Lite',
		maptilerStyleId: 'toner-v2-lite',
		fallbackStyle: STREETS_FALLBACK
	},
	{
		id: 'toner-v2-lines',
		label: 'Toner Lines',
		maptilerStyleId: 'toner-v2-lines',
		fallbackStyle: STREETS_FALLBACK
	},
	{
		id: 'openstreetmap',
		label: 'OpenStreetMap',
		maptilerStyleId: 'openstreetmap',
		fallbackStyle: STREETS_FALLBACK
	},
	{ id: 'dataviz', label: 'Dataviz', maptilerStyleId: 'dataviz', fallbackStyle: STREETS_FALLBACK },
	{
		id: 'dataviz-dark',
		label: 'Dataviz Dark',
		maptilerStyleId: 'dataviz-dark',
		fallbackStyle: STREETS_FALLBACK
	},
	{
		id: 'dataviz-light',
		label: 'Dataviz Light',
		maptilerStyleId: 'dataviz-light',
		fallbackStyle: STREETS_FALLBACK
	},
	{ id: 'backdrop', label: 'Backdrop', maptilerStyleId: 'backdrop', fallbackStyle: STREETS_FALLBACK },
	{
		id: 'backdrop-dark',
		label: 'Backdrop Dark',
		maptilerStyleId: 'backdrop-dark',
		fallbackStyle: STREETS_FALLBACK
	},
	{ id: 'ocean', label: 'Ocean', maptilerStyleId: 'ocean', fallbackStyle: STREETS_FALLBACK }
] as const satisfies readonly BaseMapCatalogEntry[]);

const KEYLESS_BASE_MAPS = [
	{ id: 'satellite', label: 'Satellite', fallbackStyle: SATELLITE_FALLBACK },
	{ id: 'streets', label: 'Streets', fallbackStyle: STREETS_FALLBACK }
] as const satisfies readonly BaseMapCatalogEntry[];

const KEYLESS_BASE_LAYER_IDS = ['satellite', 'streets'] as const satisfies readonly BaseLayerId[];

const MAPTILER_BASE_MAPS_BY_ID = new Map<BaseLayerId, BaseMapCatalogEntry>(
	MAPTILER_BASE_MAPS.map((baseMap) => [baseMap.id, baseMap])
);
const KEYLESS_BASE_MAPS_BY_ID = new Map<BaseLayerId, BaseMapCatalogEntry>(
	KEYLESS_BASE_MAPS.map((baseMap) => [baseMap.id, baseMap])
);

export const DEFAULT_BASE_LAYER_ID: BaseLayerId = 'satellite';

const createMapTilerStyleUrl = (styleId: string, maptilerKey: string): string => {
	return `https://api.maptiler.com/maps/${styleId}/style.json?key=${maptilerKey}`;
};

const getRequiredBaseMap = (
	baseMapId: BaseLayerId,
	collection: Map<BaseLayerId, BaseMapCatalogEntry>
): BaseMapCatalogEntry => {
	const baseMap = collection.get(baseMapId);
	if (!baseMap) throw new Error(`Missing basemap catalog entry for "${baseMapId}"`);
	return baseMap;
};

export const getBaseMapOptions = (maptilerKey?: string): BaseMapOption[] => {
	if (maptilerKey) {
		return BASE_LAYER_IDS.map((baseLayerId) => {
			const baseMap = getRequiredBaseMap(baseLayerId, MAPTILER_BASE_MAPS_BY_ID);
			return { id: baseLayerId, label: baseMap.label };
		});
	}

	return KEYLESS_BASE_LAYER_IDS.map((baseLayerId) => {
		const baseMap = getRequiredBaseMap(baseLayerId, KEYLESS_BASE_MAPS_BY_ID);
		return { id: baseLayerId, label: baseMap.label };
	});
};

export const getBaseMapStyle = (
	baseLayerId: BaseLayerId,
	maptilerKey?: string
): string | StyleSpecification => {
	const byId = maptilerKey ? MAPTILER_BASE_MAPS_BY_ID : KEYLESS_BASE_MAPS_BY_ID;
	const selected = byId.get(baseLayerId) ?? byId.get(DEFAULT_BASE_LAYER_ID);

	if (!selected) return FALLBACK_STREETS_STYLE;
	if (!maptilerKey || !selected.maptilerStyleId) return selected.fallbackStyle;
	return createMapTilerStyleUrl(selected.maptilerStyleId, maptilerKey);
};
