<script lang="ts">
	import {
		PressureLayer,
		RadarLayer,
		TemperatureLayer,
		WindLayer
	} from '@maptiler/weather';
	import { PUBLIC_MAPTILER_KEY } from '$env/static/public';
	import { DEFAULT_BASE_LAYER_ID, getBaseMapStyle } from '$lib/maps/base-map-catalog';
	import { createMapTilerWeatherLayerManager } from '$lib/weather/maptiler-weather-layer-manager';
	import { applyMapTilerWeatherMapShim } from '$lib/weather/maptiler-weather-map-shim';
	import { createPrecipitationLayerManager } from '$lib/weather/precipitation-layer-manager';
	import { createWeatherRasterLayerManager } from '$lib/weather/weather-raster-layer';
	import { onMount } from 'svelte';
	import maplibregl, { type Map, type StyleSpecification } from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';

	let mapElement: HTMLDivElement;
	let map: Map | undefined;
	let frameId: number | undefined;
	let precipitationSyncReady = false;
	let activeStyle: string | StyleSpecification | undefined;

	export let styleUrl: string | StyleSpecification = getBaseMapStyle(
		DEFAULT_BASE_LAYER_ID,
		PUBLIC_MAPTILER_KEY
	);
	export let center: [number, number] = [-75.566, 39.662];
	export let zoom = 1.15;
	export let pitch = 8;
	export let spinDegreesPerSecond = 0.45;
	export let interactionsEnabled = false;
	export let weatherVisible = true;
	export let weatherTileTemplate: string | undefined = undefined;
	export let precipitationVisible = true;
	export let pressureVisible = false;
	export let radarVisible = false;
	export let temperatureVisible = false;
	export let windVisible = false;
	export let onMapReady: ((map: Map) => void) | undefined = undefined;

	const weatherLayerManager = createWeatherRasterLayerManager({
		sourceId: 'weather-cmi',
		layerId: 'weather-cmi-layer',
		beforeLayerId: 'moon-orbit-layer',
		opacity: 0.72,
		fadeOutZoomStart: 8,
		fadeOutZoomEnd: 10
	});
	const precipitationLayerManager = createPrecipitationLayerManager({
		layerId: 'weather-precipitation',
		beforeLayerId: 'moon-orbit-layer',
		animationFactor: 3600
	});
	const pressureLayerManager = createMapTilerWeatherLayerManager({
		layerId: 'weather-pressure',
		layerCtor: PressureLayer,
		beforeLayerId: 'moon-orbit-layer',
		animationFactor: 3600
	});
	const radarLayerManager = createMapTilerWeatherLayerManager({
		layerId: 'weather-radar',
		layerCtor: RadarLayer,
		beforeLayerId: 'moon-orbit-layer',
		animationFactor: 3600
	});
	const temperatureLayerManager = createMapTilerWeatherLayerManager({
		layerId: 'weather-temperature',
		layerCtor: TemperatureLayer,
		beforeLayerId: 'moon-orbit-layer',
		animationFactor: 3600
	});
	const windLayerManager = createMapTilerWeatherLayerManager({
		layerId: 'weather-wind',
		layerCtor: WindLayer,
		beforeLayerId: 'moon-orbit-layer',
		animationFactor: 3600
	});

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

	const schedulePrecipitationSync = (targetMap: Map) => {
		precipitationSyncReady = false;
		targetMap.once('idle', () => {
			if (map !== targetMap) return;
			precipitationSyncReady = true;
			precipitationLayerManager.sync(targetMap, { visible: precipitationVisible });
			pressureLayerManager.sync(targetMap, { visible: pressureVisible });
			radarLayerManager.sync(targetMap, { visible: radarVisible });
			temperatureLayerManager.sync(targetMap, { visible: temperatureVisible });
			windLayerManager.sync(targetMap, { visible: windVisible });
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
			if (map) {
				applyMapTilerWeatherMapShim(map, PUBLIC_MAPTILER_KEY);
				weatherLayerManager.sync(map, {
					visible: weatherVisible,
					tileTemplate: weatherTileTemplate
				});
				schedulePrecipitationSync(map);
			}
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
			if (map) weatherLayerManager.clear(map);
			if (map) precipitationLayerManager.clear(map);
			if (map) pressureLayerManager.clear(map);
			if (map) radarLayerManager.clear(map);
			if (map) temperatureLayerManager.clear(map);
			if (map) windLayerManager.clear(map);
			map?.remove();
			map = undefined;
			precipitationSyncReady = false;
		};
	});

	$: if (map) {
		applyInteractionState(map, interactionsEnabled);
	}

	$: if (map && styleUrl !== activeStyle) {
		activeStyle = styleUrl;
		map.setStyle(styleUrl, { diff: false });
		map.once('style.load', () => {
			map?.setProjection({ type: 'globe' });
			if (map) {
				weatherLayerManager.resetAppliedState();
				precipitationLayerManager.resetAppliedState();
				pressureLayerManager.resetAppliedState();
				radarLayerManager.resetAppliedState();
				temperatureLayerManager.resetAppliedState();
				windLayerManager.resetAppliedState();
				weatherLayerManager.sync(map, {
					visible: weatherVisible,
					tileTemplate: weatherTileTemplate
				});
				schedulePrecipitationSync(map);
			}
		});
	}

	$: if (map) {
		const visible = weatherVisible;
		const tileTemplate = weatherTileTemplate;
		weatherLayerManager.sync(map, { visible, tileTemplate });
	}

	$: if (map && precipitationSyncReady) {
		precipitationLayerManager.sync(map, { visible: precipitationVisible });
		pressureLayerManager.sync(map, { visible: pressureVisible });
		radarLayerManager.sync(map, { visible: radarVisible });
		temperatureLayerManager.sync(map, { visible: temperatureVisible });
		windLayerManager.sync(map, { visible: windVisible });
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
