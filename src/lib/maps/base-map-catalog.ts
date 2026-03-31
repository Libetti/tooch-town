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

const assertCatalogCoverage = <T extends readonly BaseMapCatalogEntry[]>(
	catalog: T &
		(Exclude<BaseLayerId, T[number]['id']> extends never
			? unknown
			: ['Missing base-map entries for ids', Exclude<BaseLayerId, T[number]['id']>])
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
] as const);

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

export const DEFAULT_BASE_LAYER_ID: BaseLayerId = 'voyager-v2-darkmatter';

const createMapTilerStyleUrl = (styleId: string, maptilerKey: string): string => {
	return `https://api.maptiler.com/maps/${styleId}/style.json?key=${maptilerKey}`;
};

const BASE_MAP_DESCRIPTIONS: Record<BaseLayerId, string> = {
	satellite: 'Up-to-date global satellite imagery with high-resolution aerial coverage in many regions.',
	hybrid: 'Satellite imagery with roads, boundaries, and place labels layered on top for easier orientation.',
	streets: 'A complete, legible street map built for everyday navigation and general map context.',
	'streets-v2': 'A refined full-detail street basemap for city browsing, navigation, and general reference.',
	'streets-v2-dark':
		'A night-friendly street map that keeps roads and labels clear against a dark background.',
	'streets-v2-light':
		'A light street basemap with a softer palette that stays readable without overpowering overlays.',
	'streets-v2-night':
		'A moody nighttime street style with deep colors and bright labels for after-dark map viewing.',
	'streets-v2-pastel':
		'A pastel street map that softens the palette while preserving road and place detail.',
	'outdoor-v2':
		'A terrain-rich outdoor map that highlights trails, landforms, parks, and mountain context.',
	'outdoor-v2-dark':
		'A darker outdoor style that preserves trail and terrain detail for low-light viewing.',
	'winter-v2':
		'A cool, winter-themed terrain map that emphasizes snowy landforms, resorts, and seasonal context.',
	'winter-v2-dark':
		'A dark winter variant with icy tones and terrain contrast suited to evening map displays.',
	'basic-v2': 'A lightweight, informative basemap with reduced clutter and a neutral cartographic tone.',
	'basic-v2-dark':
		'A streamlined dark basemap that keeps core reference detail without a busy visual field.',
	'basic-v2-light':
		'A clean light basemap with restrained detail for interfaces that need a quiet geographic backdrop.',
	'bright-v2': 'A vivid, colorful reference map with strong contrast and easy-to-scan cartographic detail.',
	'bright-v2-dark':
		'A bold dark map with colorful accents that helps labels and overlays stand out clearly.',
	'bright-v2-light':
		'A bright light-toned style with crisp contrast and a lively, modern cartographic look.',
	'bright-v2-pastel':
		'A softer bright style that trades saturated colors for a gentler pastel appearance.',
	'topo-v2':
		'A classic topographic map with terrain shading, elevation cues, and landform-focused detail.',
	'topo-v2-shiny':
		'A glossy topographic style with stronger relief and more pronounced terrain contrast.',
	'topo-v2-pastel':
		'A pastel topographic map that keeps elevation context while using a softer color treatment.',
	'topo-v2-topographique':
		'A French-inspired topographic style with detailed relief and a print-atlas feel.',
	'voyager-v2':
		'A balanced reference map with clear hierarchy, practical labels, and an all-purpose travel feel.',
	'voyager-v2-darkmatter':
		'A dark Voyager variant tuned for overlay-heavy maps, with labels that stay readable at a glance.',
	'voyager-v2-positron':
		'A light Voyager variant that provides clean geographic context without competing with data layers.',
	'voyager-v2-vintage':
		'A warm retro basemap with vintage tones that give modern geography an old-atlas character.',
	'toner-v2': 'A bold black-and-white map style built around crisp lines and stark cartographic contrast.',
	'toner-v2-background':
		'A stripped-down monochrome background that keeps the Toner look with minimal distraction.',
	'toner-v2-lite':
		'A lighter grayscale Toner variant that preserves detail without the heaviest black fills.',
	'toner-v2-lines':
		'A linework-only Toner style that emphasizes roads, boundaries, and graphic structure.',
	openstreetmap: 'A classic OpenStreetMap rendering shaped by community-maintained global map data.',
	dataviz: 'A data-first basemap designed to help thematic overlays stand out without extra styling work.',
	'dataviz-dark':
		'A dark data-visualization style that keeps geography present while giving overlays more contrast.',
	'dataviz-light':
		'A light data-visualization style that reduces color noise so thematic layers remain the focus.',
	backdrop:
		'A muted contextual basemap that frames overlays with subtle land, water, and label treatment.',
	'backdrop-dark':
		'A dark, subdued backdrop style made to support overlays without demanding visual attention.',
	ocean: 'A marine-focused map that emphasizes coastlines, bathymetric context, and ocean geography.'
};

const getBaseMapDescription = (baseLayerId: BaseLayerId): string => {
	return BASE_MAP_DESCRIPTIONS[baseLayerId] ?? 'MapTiler basemap style.';
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
			return { id: baseLayerId, label: baseMap.label, description: getBaseMapDescription(baseLayerId) };
		});
	}

	return KEYLESS_BASE_LAYER_IDS.map((baseLayerId) => {
		const baseMap = getRequiredBaseMap(baseLayerId, KEYLESS_BASE_MAPS_BY_ID);
		return { id: baseLayerId, label: baseMap.label, description: getBaseMapDescription(baseLayerId) };
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
