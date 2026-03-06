<script lang="ts">
	import { PUBLIC_MAPTILER_KEY } from '$env/static/public';
	import { onMount } from 'svelte';
	import maplibregl, { type Map, type StyleSpecification } from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';

	let mapElement: HTMLDivElement;
	let map: Map | undefined;
	let frameId: number | undefined;

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
	export let onMapReady: ((map: Map) => void) | undefined = undefined;

	const wrapLongitude = (longitude: number): number => {
		return ((((longitude + 180) % 360) + 360) % 360) - 180;
	};

	onMount(() => {
		const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		try {
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
			map?.dragPan.disable();
			map?.dragRotate.disable();
			map?.doubleClickZoom.disable();
			map?.boxZoom.disable();
			map?.keyboard.disable();
			map?.touchZoomRotate.disableRotation();

			map?.setProjection({ type: 'globe' });
			if (map) onMapReady?.(map);

			if (prefersReducedMotion || !map) return;

			let spinLongitude = map.getCenter().lng;
			const spinLatitude = map.getCenter().lat;
			let lastTime = performance.now();
			const tick = (now: number) => {
				if (!map) return;

				const deltaSeconds = (now - lastTime) / 1000;
				lastTime = now;

				// Earth rotates west-to-east, so the camera-facing longitude drifts west over time.
				spinLongitude = wrapLongitude(spinLongitude - deltaSeconds * spinDegreesPerSecond);
				map.setCenter([spinLongitude, spinLatitude]);

				frameId = requestAnimationFrame(tick);
			};

			frameId = requestAnimationFrame(tick);
		});

		return () => {
			if (frameId !== undefined) cancelAnimationFrame(frameId);
			map?.remove();
			map = undefined;
		};
	});
</script>

<div class="globe-shell" aria-hidden="true">
	<div class="space-gradient"></div>
	<div class="starfield starfield-far"></div>
	<div class="starfield starfield-near"></div>
	<div class="glimmer glimmer-a"></div>
	<div class="glimmer glimmer-b"></div>
	<div bind:this={mapElement} class="globe-map"></div>
	<div class="space-vignette"></div>
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
	.glimmer,
	.space-vignette {
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
		pointer-events: auto;
		filter: saturate(1.12) contrast(1.08);
	}

	.space-vignette {
		background:
			radial-gradient(
				circle at 50% 45%,
				rgba(110, 182, 255, 0.2) 0%,
				rgba(75, 139, 222, 0.11) 27%,
				rgba(7, 18, 38, 0) 48%,
				rgba(2, 8, 20, 0.66) 100%
			),
			linear-gradient(to bottom, rgba(2, 8, 20, 0.26), rgba(2, 8, 20, 0.6));
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

	@media (prefers-reduced-motion: reduce) {
		.starfield,
		.glimmer {
			animation: none;
		}
	}
</style>
