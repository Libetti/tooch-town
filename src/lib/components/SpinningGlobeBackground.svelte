<script lang="ts">
	import { onMount } from 'svelte';
	import maplibregl, { type Map } from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';

	let mapElement: HTMLDivElement;
	let map: Map | undefined;
	let frameId: number | undefined;

	export let styleUrl = 'https://demotiles.maplibre.org/style.json';
	export let center: [number, number] = [-75.566, 39.662];
	export let zoom = 1.15;
	export let pitch = 8;
	export let spinDegreesPerSecond = 0.45;
	export let onMapReady: ((map: Map) => void) | undefined = undefined;

	onMount(() => {
		const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		map = new maplibregl.Map({
			container: mapElement,
			style: styleUrl,
			center,
			zoom,
			pitch,
			bearing: 0,
			interactive: false,
			attributionControl: false,
			renderWorldCopies: false
		});

		map.once('load', () => {
			map?.setProjection({ type: 'globe' });
			if (map) onMapReady?.(map);

			if (prefersReducedMotion || !map) return;

			let lastTime = performance.now();
			const tick = (now: number) => {
				if (!map) return;

				const deltaSeconds = (now - lastTime) / 1000;
				lastTime = now;

				const nextBearing = (map.getBearing() + deltaSeconds * spinDegreesPerSecond) % 360;
				map.rotateTo(nextBearing, { duration: 0 });

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
	<div bind:this={mapElement} class="globe-map"></div>
	<div class="globe-tint"></div>
</div>

<style>
	.globe-shell {
		position: fixed;
		inset: 0;
		z-index: 0;
		pointer-events: none;
		overflow: hidden;
		background: #0d2032;
	}

	.globe-map {
		position: absolute;
		inset: 0;
	}

	.globe-tint {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(circle at 18% 20%, rgba(255, 255, 255, 0.34), rgba(255, 255, 255, 0.08) 58%),
			linear-gradient(to bottom, rgba(12, 27, 43, 0.24), rgba(12, 27, 43, 0.46));
	}

	:global(.globe-shell .maplibregl-ctrl-bottom-left),
	:global(.globe-shell .maplibregl-ctrl-bottom-right),
	:global(.globe-shell .maplibregl-ctrl-top-left),
	:global(.globe-shell .maplibregl-ctrl-top-right) {
		display: none;
	}
</style>
