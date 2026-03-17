<script lang="ts">
	import { PUBLIC_MAPTILER_KEY } from '$env/static/public';
	import { onMount } from 'svelte';
	import maplibregl, { type Map, type StyleSpecification } from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';

	let mapElement: HTMLDivElement;
	let map: Map | undefined;
	let frameId: number | undefined;
	let activeStyle: string | StyleSpecification | undefined;

	const LEGACY_SATELLITE_STYLE: StyleSpecification = {
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
		layers: [
			{
				id: 'esri-satellite-base',
				type: 'raster',
				source: 'esriSatellite',
				minzoom: 0,
				maxzoom: 22
			}
		]
	};

	const MAPTILER_SATELLITE_STYLE = PUBLIC_MAPTILER_KEY
		? `https://api.maptiler.com/maps/satellite/style.json?key=${PUBLIC_MAPTILER_KEY}`
		: LEGACY_SATELLITE_STYLE;

	export let styleUrl: string | StyleSpecification = MAPTILER_SATELLITE_STYLE;
	export let center: [number, number] = [-75.566, 39.662];
	export let zoom = 1.15;
	export let pitch = 8;
	export let spinDegreesPerSecond = 0.45;
	export let interactionsEnabled = false;
	export let weatherVisible = true;
	export let weatherTileTemplate: string | undefined = undefined;
	export let onMapReady: ((map: Map) => void) | undefined = undefined;

	const WEATHER_SOURCE_ID = 'weather-cmi';
	const WEATHER_LAYER_ID = 'weather-cmi-layer';
	const WEATHER_LAYER_OPACITY = 0.75;

	const wrapLongitude = (longitude: number): number => {
		return ((((longitude + 180) % 360) + 360) % 360) - 180;
	};

	const applyInteractionState = (targetMap: Map, enabled: boolean) => {
		if (enabled) {
			targetMap.dragPan.enable();
			targetMap.scrollZoom.enable();
			targetMap.touchZoomRotate.enable();
			targetMap.touchZoomRotate.disableRotation();
			return;
		}

		targetMap.dragPan.disable();
		targetMap.scrollZoom.disable();
		targetMap.doubleClickZoom.disable();
		targetMap.boxZoom.disable();
		targetMap.keyboard.disable();
		targetMap.touchZoomRotate.disable();
	};

	const makeMapBackgroundTransparent = (targetMap: Map) => {
		const style = targetMap.getStyle();
		if (!style?.layers) return;

		for (const layer of style.layers) {
			if (layer.type === 'background') {
				targetMap.setPaintProperty(layer.id, 'background-opacity', 0);
			}
		}
	};

	const removeWeatherLayer = (targetMap: Map): void => {
		if (targetMap.getLayer(WEATHER_LAYER_ID)) {
			targetMap.removeLayer(WEATHER_LAYER_ID);
		}
		if (targetMap.getSource(WEATHER_SOURCE_ID)) {
			targetMap.removeSource(WEATHER_SOURCE_ID);
		}
	};

	const syncWeatherLayer = (targetMap: Map): void => {
		if (!targetMap.isStyleLoaded()) return;

		if (!weatherVisible || !weatherTileTemplate) {
			removeWeatherLayer(targetMap);
			return;
		}

		removeWeatherLayer(targetMap);
		targetMap.addSource(WEATHER_SOURCE_ID, {
			type: 'raster',
			tiles: [weatherTileTemplate],
			tileSize: 256
		});
		targetMap.addLayer({
			id: WEATHER_LAYER_ID,
			type: 'raster',
			source: WEATHER_SOURCE_ID,
			paint: {
				'raster-opacity': WEATHER_LAYER_OPACITY
			}
		});
	};

	onMount(() => {
		const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		try {
			activeStyle = styleUrl;
			map = new maplibregl.Map({
				container: mapElement,
				style: styleUrl,
				center,
				zoom,
				pitch,
				bearing: 0,
				interactive: true,
				attributionControl: false,
				renderWorldCopies: false
			});
		} catch {
			return () => {
				if (frameId !== undefined) cancelAnimationFrame(frameId);
				map?.remove();
				map = undefined;
			};
		}

		map.once('load', () => {
			map?.dragRotate.disable();
			if (map) applyInteractionState(map, interactionsEnabled);

			map?.setProjection({ type: 'globe' });
			if (map) makeMapBackgroundTransparent(map);
			if (map) syncWeatherLayer(map);
			if (map) onMapReady?.(map);

			if (prefersReducedMotion || !map) return;

			let spinLongitude = map.getCenter().lng;
			const spinLatitude = map.getCenter().lat;
			let lastTime = performance.now();
			const tick = (now: number) => {
				if (!map) return;

				const deltaSeconds = (now - lastTime) / 1000;
				lastTime = now;

				if (interactionsEnabled) {
					frameId = requestAnimationFrame(tick);
					return;
				}

				// Earth rotates west-to-east, so the camera-facing longitude drifts west over time.
				spinLongitude = wrapLongitude(spinLongitude - deltaSeconds * spinDegreesPerSecond);
				map.setCenter([spinLongitude, spinLatitude]);

				frameId = requestAnimationFrame(tick);
			};

			frameId = requestAnimationFrame(tick);
		});

		return () => {
			if (frameId !== undefined) cancelAnimationFrame(frameId);
			if (map) removeWeatherLayer(map);
			map?.remove();
			map = undefined;
		};
	});

	$: if (map) {
		applyInteractionState(map, interactionsEnabled);
	}

	$: if (map && styleUrl !== activeStyle) {
		activeStyle = styleUrl;
		map.setStyle(styleUrl);
		map.once('style.load', () => {
			map?.setProjection({ type: 'globe' });
			if (map) makeMapBackgroundTransparent(map);
			if (map) syncWeatherLayer(map);
		});
	}

	$: if (map) {
		syncWeatherLayer(map);
	}
</script>

<div class="globe-shell" aria-hidden="true">
	<div class="space-gradient"></div>
	<div class="starfield starfield-far"></div>
	<div class="starfield starfield-near"></div>
	<div class="glimmer glimmer-a"></div>
	<div class="glimmer glimmer-b"></div>
	<div bind:this={mapElement} class:interactive={interactionsEnabled} class="globe-map"></div>
</div>

<style>
	.globe-shell {
		position: fixed;
		inset: 0;
		z-index: 0;
		pointer-events: none;
		overflow: hidden;
		background: #020712;
	}

	.space-gradient,
	.starfield,
	.glimmer {
		position: absolute;
		inset: 0;
	}

	.space-gradient {
		background:
			radial-gradient(circle at 18% 22%, rgba(34, 73, 142, 0.32), rgba(4, 10, 24, 0) 35%),
			radial-gradient(circle at 84% 15%, rgba(96, 48, 130, 0.2), rgba(3, 8, 18, 0) 32%),
			linear-gradient(to bottom, #061326 0%, #020712 58%, #01040c 100%);
	}

	.starfield {
		background-repeat: repeat;
		will-change: transform;
		animation: spaceDrift linear infinite;
	}

	.starfield-far {
		background-image:
			radial-gradient(1.1px 1.1px at 12% 22%, rgba(255, 255, 255, 0.66) 99%, transparent 100%),
			radial-gradient(1.1px 1.1px at 76% 68%, rgba(255, 255, 255, 0.62) 99%, transparent 100%),
			radial-gradient(1.1px 1.1px at 40% 84%, rgba(255, 255, 255, 0.52) 99%, transparent 100%),
			radial-gradient(1.1px 1.1px at 58% 36%, rgba(198, 224, 255, 0.56) 99%, transparent 100%),
			radial-gradient(1px 1px at 24% 48%, rgba(240, 248, 255, 0.52) 99%, transparent 100%),
			radial-gradient(1px 1px at 68% 14%, rgba(209, 231, 255, 0.48) 99%, transparent 100%),
			radial-gradient(1px 1px at 86% 52%, rgba(255, 255, 255, 0.46) 99%, transparent 100%),
			radial-gradient(1px 1px at 34% 12%, rgba(216, 236, 255, 0.44) 99%, transparent 100%),
			radial-gradient(1px 1px at 52% 72%, rgba(245, 250, 255, 0.5) 99%, transparent 100%),
			radial-gradient(1px 1px at 8% 78%, rgba(212, 233, 255, 0.44) 99%, transparent 100%);
		background-size: 250px 250px;
		opacity: 0.68;
		animation-duration: 210s;
	}

	.starfield-near {
		background-image:
			radial-gradient(1.5px 1.5px at 18% 42%, rgba(255, 255, 255, 0.94) 99%, transparent 100%),
			radial-gradient(1.7px 1.7px at 65% 18%, rgba(236, 245, 255, 0.96) 99%, transparent 100%),
			radial-gradient(1.4px 1.4px at 82% 72%, rgba(223, 240, 255, 0.9) 99%, transparent 100%),
			radial-gradient(1.6px 1.6px at 42% 12%, rgba(255, 255, 255, 0.88) 99%, transparent 100%),
			radial-gradient(1.4px 1.4px at 30% 68%, rgba(205, 229, 255, 0.86) 99%, transparent 100%);
		background-size: 430px 430px;
		opacity: 0.84;
		animation-duration: 135s;
	}

	.glimmer {
		background-repeat: repeat;
		mix-blend-mode: screen;
	}

	.glimmer-a {
		background-image:
			radial-gradient(2.4px 2.4px at 8% 18%, rgba(179, 221, 255, 0.98) 98%, transparent 100%),
			radial-gradient(2.4px 2.4px at 32% 66%, rgba(255, 255, 255, 0.96) 98%, transparent 100%),
			radial-gradient(2.1px 2.1px at 58% 34%, rgba(179, 228, 255, 0.92) 98%, transparent 100%),
			radial-gradient(2.4px 2.4px at 78% 22%, rgba(255, 255, 255, 0.98) 98%, transparent 100%),
			radial-gradient(2.1px 2.1px at 88% 70%, rgba(183, 218, 255, 0.88) 98%, transparent 100%);
		background-size: 620px 620px;
		opacity: 0.6;
		filter: blur(0.1px);
		animation:
			glimmerPulseA 6.2s ease-in-out infinite,
			spaceDrift 260s linear infinite;
	}

	.glimmer-b {
		background-image:
			radial-gradient(2px 2px at 14% 82%, rgba(255, 255, 255, 0.84) 98%, transparent 100%),
			radial-gradient(2.2px 2.2px at 44% 14%, rgba(175, 231, 255, 0.88) 98%, transparent 100%),
			radial-gradient(2.1px 2.1px at 62% 56%, rgba(255, 255, 255, 0.84) 98%, transparent 100%),
			radial-gradient(2.2px 2.2px at 72% 84%, rgba(167, 216, 255, 0.9) 98%, transparent 100%),
			radial-gradient(2px 2px at 94% 36%, rgba(255, 255, 255, 0.84) 98%, transparent 100%);
		background-size: 760px 760px;
		opacity: 0.5;
		filter: blur(0.2px);
		animation:
			glimmerPulseB 8.4s ease-in-out infinite,
			spaceDrift 320s linear infinite reverse;
	}

	.globe-map {
		position: absolute;
		inset: 0;
		pointer-events: none;
		filter: saturate(1.12) contrast(1.08);
	}

	.globe-map.interactive {
		pointer-events: auto;
	}

	@keyframes spaceDrift {
		from {
			transform: translate3d(0, 0, 0);
		}
		to {
			transform: translate3d(-140px, 60px, 0);
		}
	}

	@keyframes glimmerPulseA {
		0%,
		100% {
			opacity: 0.35;
		}
		45% {
			opacity: 0.78;
		}
		70% {
			opacity: 0.5;
		}
	}

	@keyframes glimmerPulseB {
		0%,
		100% {
			opacity: 0.28;
		}
		40% {
			opacity: 0.66;
		}
		78% {
			opacity: 0.42;
		}
	}

	:global(.globe-shell .maplibregl-ctrl-bottom-left),
	:global(.globe-shell .maplibregl-ctrl-bottom-right),
	:global(.globe-shell .maplibregl-ctrl-top-left),
	:global(.globe-shell .maplibregl-ctrl-top-right) {
		display: none;
	}

	:global(.globe-shell .lightning-strike-popup) {
		z-index: 6;
	}

	:global(.globe-shell .lightning-strike-popup .maplibregl-popup-content) {
		background: rgba(7, 16, 29, 0.94);
		color: #e8f1ff;
		border: 1px solid rgba(166, 198, 255, 0.32);
		border-radius: 0.7rem;
		box-shadow: 0 16px 34px rgba(1, 6, 16, 0.55);
		padding: 0.7rem 0.82rem;
		line-height: 1.4;
		font-family: 'Avenir Next', Avenir, 'Segoe UI', sans-serif;
	}

	:global(.globe-shell .lightning-strike-popup .maplibregl-popup-tip) {
		display: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.starfield,
		.glimmer {
			animation: none;
		}
	}
</style>
