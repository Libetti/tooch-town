<script lang="ts">
	import { PUBLIC_MAPTILER_KEY } from '$env/static/public';
	import { createLightningLayerController } from '$lib/lightning/lightning-layer-controller';
	import { createCmiRasterLayerController } from '$lib/weather/cmi-raster-layer-controller';
	import { mountMoonOrbitLayer } from '$lib/space/moon-orbit-layer';
	import {
		mountSpaceBattleLayer,
		type SpaceBattleLayerController,
		type SpaceBattleShipPlacement
	} from '$lib/space/space-battle-layer';
	import {
		DEFAULT_BASE_LAYER_ID,
		getBaseMapOptions,
		getBaseMapStyle
	} from '$lib/maps/base-map-catalog';
	import type { BaseLayerId } from '$lib/maps/base-layer-ids';
	import type { Map as MapLibreMap } from 'maplibre-gl';
	import MapContainer from '$lib/components/MapContainer.svelte';
	import LayerSidebar from '$lib/components/LayerSidebar.svelte';
	import { onMount } from 'svelte';
	import type { LayerRegistry } from '$lib/layers/layer-registry';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let cardsCollapsed = $state(false);
	let selectedBaseLayer = $state<BaseLayerId>(DEFAULT_BASE_LAYER_ID);
	let selectedWeatherSatellite = $state<'goes-east' | 'goes-west'>('goes-east');
	let weatherLayerEnabled = $state(false);
	let precipitationLayerEnabled = $state(false);
	let pressureLayerEnabled = $state(false);
	let radarLayerEnabled = $state(true);
	let temperatureLayerEnabled = $state(false);
	let windLayerEnabled = $state(false);
	let lightningLayerEnabled = $state(true);
	let spaceBattleLayerEnabled = $state(true);
	let lightningHeatmapVisible = $state(true);
	let lightningStrikesVisible = $state(true);
	let selectedLightningSatellite = $state<'all' | 'goes-east' | 'goes-west'>('all');
	let weatherTileTemplate = $state<string | undefined>(undefined);
	let layerSidebarOpen = $state(false);
	let removeMoonOrbitLayer: (() => void) | undefined;
	let spaceBattleLayerController: SpaceBattleLayerController | undefined;
	let mapRef: MapLibreMap | undefined;

	const lightningLayerController = createLightningLayerController({
		apiPath: '/api/lightning/recent',
		pollIntervalMs: 15_000
	});
	const cmiRasterLayerController = createCmiRasterLayerController({
		apiPath: '/api/imagery/cmi/ch13/frames',
		tilePathPrefix: '/api/imagery/cmi/ch13/tiles',
		satellite: 'goes-east',
		visible: false,
		frameLimit: 12,
		pollHintSeconds: 10,
		animationIntervalMs: 700
	});

	$effect(() => {
		cmiRasterLayerController.setSatellite(selectedWeatherSatellite);
	});

	$effect(() => {
		cmiRasterLayerController.setVisible(weatherLayerEnabled);
	});

	$effect(() => {
		lightningLayerController.setHeatmapVisible(lightningHeatmapVisible);
	});

	$effect(() => {
		lightningLayerController.setStrikesVisible(lightningStrikesVisible);
	});

	$effect(() => {
		lightningLayerController.setSatelliteFilter(selectedLightningSatellite);
	});

	$effect(() => {
		if (lightningLayerEnabled) {
			lightningLayerController.start();
			return;
		}
		lightningLayerController.stop();
	});

	$effect(() => {
		if (!cardsCollapsed) layerSidebarOpen = false;
	});

	const syncSpaceBattleLayer = (map: MapLibreMap) => {
		const ships: SpaceBattleShipPlacement[] = [
			{
				id: 'lucrehulk',
				modelUrl: '/models/lucrehulk.glb',
				longitude: -95.3,
				latitude: 61.3,
				scaleMeters: 50_000,
				altitudeMeters: 2_150_000,
				rotationDeg: [0, 140, 0]
			},
			{
				id: 'munificent-s7',
				modelUrl: '/models/munificent_basic.glb',
				longitude: -105.3,
				latitude: 66.3,
				scaleMeters: 52_500,
				altitudeMeters: 2_250_000,
				rotationDeg: [-180, 60, 180]
			},
			{
				id: 'munificent-s7-1',
				modelUrl: '/models/munificent_basic.glb',
				longitude: -82.3,
				latitude: 63.3,
				scaleMeters: 52_500,
				altitudeMeters: 2_250_000,
				rotationDeg: [150, 140, 200]
			},
			{
				id: 'separatist-dreadnaught',
				modelUrl: '/models/separatist_dreadnaught.glb',
				longitude: -29.2,
				latitude: 76.8,
				altitudeMeters: 800_000,
				scaleMeters: 35_000,
				rotationDeg: [190, 90, 180]
			},
			{
				id: 'venator-1',
				modelUrl: '/models/venator.glb',
				longitude: -29.2,
				latitude: 80.8,
				altitudeMeters: 1_150_000,
				scaleMeters: 105_000,
				rotationDeg: [180, 300, 180]
			},
			{
				id: 'venator-2',
				modelUrl: '/models/venator.glb',
				longitude: -29.2,
				latitude: 72.5,
				altitudeMeters: 900_000,
				scaleMeters: 105_000,
				rotationDeg: [190, 290, 180]
			},
			{
				id: 'arquitens-1',
				modelUrl: '/models/arquitens.glb',
				longitude: -40,
				latitude: 10.2,
				scaleMeters: 24_500,
				rotationDeg: [0, 200, 0],
				altitudeMeters: 500_000
			},
			{
				id: 'arquitens-2',
				modelUrl: '/models/arquitens.glb',
				longitude: -60,
				latitude: 10.2,
				scaleMeters: 24_500,
				rotationDeg: [0, 210, 0],
				altitudeMeters: 300_000
			}
		];
		if (!spaceBattleLayerController) {
				spaceBattleLayerController = mountSpaceBattleLayer(map, {
					visible: spaceBattleLayerEnabled,
					layerId: 'space-battle-layer',
					beforeLayerId: 'moon-orbit-layer',
					defaultAltitudeMeters: 1_000_000,
					ships
				});
			return;
		}

		spaceBattleLayerController.setVisible(spaceBattleLayerEnabled);
	};

	onMount(() => {
		const unsubscribeWeather = cmiRasterLayerController.tileTemplate.subscribe((tileTemplate) => {
			weatherTileTemplate = tileTemplate;
		});
		cmiRasterLayerController.start();

		return () => {
			unsubscribeWeather();
			lightningLayerController.stop();
			cmiRasterLayerController.stop();
			removeMoonOrbitLayer?.();
			removeMoonOrbitLayer = undefined;
			spaceBattleLayerController?.destroy();
			spaceBattleLayerController = undefined;
			mapRef = undefined;
		};
	});

	const baseMapOptions = getBaseMapOptions(PUBLIC_MAPTILER_KEY);
	const selectedStyleUrl = $derived(getBaseMapStyle(selectedBaseLayer, PUBLIC_MAPTILER_KEY));

	const projects = [
		{
			name: 'My Flightfeeder',
			description: 'Live view of my hosted fightfeeder',
			href: '/feeder',
			label: 'View Feeder Map'
		},
		{
			name: 'Farm Health',
			description: 'Check the health of my humble farm',
			href: '/feeder',
			label: 'View Feeder Map'
		},
		{
			name: 'Upcoming AI project....',
			description: 'Wee Wooo Coming Soon!',
			href: '#',
			label: 'DO NOT TOUCH'
		}
	];

	const layerRegistry = $derived<LayerRegistry>({
		baseMaps: baseMapOptions,
		layers: [
			{
				id: 'lightning',
				label: 'Lightning',
				enabled: lightningLayerEnabled,
				description: 'GLM lightning strikes rendered as a decaying heatmap and strike points.',
				controls: [
					{
						kind: 'toggle',
						id: 'heatmap',
						label: 'Heatmap',
						value: lightningHeatmapVisible,
						disabled: !lightningLayerEnabled
					},
					{
						kind: 'toggle',
						id: 'strikes',
						label: 'Strike Points',
						value: lightningStrikesVisible,
						disabled: !lightningLayerEnabled
					},
					{
						kind: 'select',
						id: 'satellite',
						label: 'Satellite Feed',
						value: selectedLightningSatellite,
						disabled: !lightningLayerEnabled,
						options: [
							{ value: 'all', label: 'All' },
							{ value: 'goes-east', label: 'GOES-East' },
							{ value: 'goes-west', label: 'GOES-West' }
						]
					}
				]
			},
			{
				id: 'weather-cmi',
				label: 'Weather',
				enabled: weatherLayerEnabled,
				description: 'GOES channel 13 cloud-top infrared imagery.',
				controls: [
					{
						kind: 'select',
						id: 'satellite',
						label: 'Satellite Feed',
						value: selectedWeatherSatellite,
						disabled: !weatherLayerEnabled,
						options: [
							{ value: 'goes-east', label: 'GOES-East' },
							{ value: 'goes-west', label: 'GOES-West' }
						]
					}
				]
			},
			{
				id: 'weather-precipitation',
				label: 'Precipitation',
				enabled: precipitationLayerEnabled,
				description:
					'Forecast window: current model run through the next ~4 days (hourly). Playback is ~1 forecast hour per second.'
			},
			{
				id: 'weather-pressure',
				label: 'Pressure',
				enabled: pressureLayerEnabled,
				description:
					'Forecast window: current model run through the next ~4 days (hourly). Playback is ~1 forecast hour per second.'
			},
			{
				id: 'weather-radar',
				label: 'Radar',
				enabled: radarLayerEnabled,
				description:
					'Forecast window: current model run through the next ~4 days (hourly). Playback is ~1 forecast hour per second.'
			},
			{
				id: 'weather-temperature',
				label: 'Temperature',
				enabled: temperatureLayerEnabled,
				description:
					'Forecast window: current model run through the next ~4 days (hourly). Playback is ~1 forecast hour per second.'
			},
			{
				id: 'weather-wind',
				label: 'Wind',
				enabled: windLayerEnabled,
				description:
					'Forecast window: current model run through the next ~4 days (hourly). Playback is ~1 forecast hour per second.'
			},
			{
				id: 'space-battle',
				label: 'Space Battle',
				enabled: spaceBattleLayerEnabled,
				description: 'Multi-ship 3D fleet scenegraph formation.'
			}
		]
	});
</script>

<svelte:head>
	<title>Anthony Libetti | Tooch Town</title>
	<meta
		name="description"
		content="Personal landing page for Anthony Libetti and the projects being built in Tooch Town."
	/>
</svelte:head>

<MapContainer
	styleUrl={selectedStyleUrl}
	center={data.initialCenter}
	zoom={2}
	pitch={0}
	spinDegreesPerSecond={0.6}
	interactionsEnabled={cardsCollapsed}
	weatherLegendEnabled={cardsCollapsed}
	weatherVisible={weatherLayerEnabled}
	{weatherTileTemplate}
	precipitationVisible={precipitationLayerEnabled}
	pressureVisible={pressureLayerEnabled}
	radarVisible={radarLayerEnabled}
	temperatureVisible={temperatureLayerEnabled}
	windVisible={windLayerEnabled}
	onMapReady={(map) => {
		lightningLayerController.attach(map);
		mapRef = map;
		removeMoonOrbitLayer?.();
		removeMoonOrbitLayer = mountMoonOrbitLayer(map, {
			layerId: 'moon-orbit-layer',
			modelUrl: '/models/Moon_Glb.glb',
			orbitPeriodSeconds: 90,
			orbitAltitudeMeters: 4_500_000,
			orbitInclinationDeg: 26,
			modelScaleMeters: 1_600_000
		});
		syncSpaceBattleLayer(map);
	}}
/>

{#if !cardsCollapsed}
	<main class="landing">
		<section class="hero" aria-labelledby="about-title">
			<button
				type="button"
				class="collapse-cards"
				aria-label="Hide cards"
				onclick={() => {
					cardsCollapsed = true;
				}}>x</button
			>
			<p class="eyebrow">Tooch Town</p>
			<h1 id="about-title">Anthony Libetti</h1>
			<p class="intro">
				So you made it, welcome to my hood bitches. Home to me, a map-fancy software engineer whose
				life mission is to continue to afford a series of stupid hobbies which end up abandoned.
			</p>
			<div class="links" aria-label="profile links">
				<a href="https://github.com/libetti" target="_blank" rel="noreferrer">GitHub</a>
				<a href="https://www.linkedin.com/in/libetti" target="_blank" rel="noreferrer">LinkedIn</a>
				<a href="mailto:anthony.libetti@yahoo.com" target="_blank" rel="noreferrer">Email</a>
			</div>
		</section>

		<div class="content-grid">
			<section class="panel projects" aria-labelledby="projects-title">
				<div class="section-heading">
					<h2 id="projects-title">Current Projects</h2>
					<p>A quick snapshot of what this site will host.</p>
				</div>
				<ul class="project-list">
					{#each projects as project (project.name)}
						<li class="project-item">
							<div>
								<h3>{project.name}</h3>
								<p>{project.description}</p>
							</div>
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
							<a href={project.href}>{project.label}</a>
						</li>
					{/each}
				</ul>
			</section>

			<section class="panel musings" aria-labelledby="musings-title">
				<div class="section-heading">
					<h2 id="musings-title">Musings</h2>
					<p>Article titles will live here.</p>
				</div>
				<div class="musings-empty" role="status">No titles published yet.</div>
			</section>
		</div>
	</main>
{:else}
	<div class="card-restore-bar">
		<button
			type="button"
			class="restore-cards"
			onclick={() => {
				cardsCollapsed = false;
			}}>Open Menu</button
		>
		<button
			type="button"
			class="open-layers"
			aria-haspopup="dialog"
			aria-expanded={layerSidebarOpen}
			onclick={() => {
				layerSidebarOpen = true;
			}}>Layers</button
		>
	</div>
{/if}

<LayerSidebar
	open={layerSidebarOpen}
	{selectedBaseLayer}
	registry={layerRegistry}
	onClose={() => {
		layerSidebarOpen = false;
	}}
	onBaseLayerChange={(detail) => {
		selectedBaseLayer = detail.value;
	}}
	onLayerToggle={(detail) => {
		if (detail.layerId === 'weather-cmi') {
			weatherLayerEnabled = detail.enabled;
			return;
		}
		if (detail.layerId === 'weather-precipitation') {
			precipitationLayerEnabled = detail.enabled;
			return;
		}
		if (detail.layerId === 'weather-pressure') {
			pressureLayerEnabled = detail.enabled;
			return;
		}
		if (detail.layerId === 'weather-radar') {
			radarLayerEnabled = detail.enabled;
			return;
		}
		if (detail.layerId === 'weather-temperature') {
			temperatureLayerEnabled = detail.enabled;
			return;
		}
		if (detail.layerId === 'weather-wind') {
			windLayerEnabled = detail.enabled;
			return;
		}
		if (detail.layerId === 'lightning') {
			lightningLayerEnabled = detail.enabled;
			return;
		}
		if (detail.layerId === 'space-battle') {
			spaceBattleLayerEnabled = detail.enabled;
			if (mapRef) syncSpaceBattleLayer(mapRef);
		}
	}}
	onLayerControlChange={(detail) => {
		if (detail.layerId === 'weather-cmi') {
			if (detail.controlId !== 'satellite') return;
			if (typeof detail.value !== 'string') return;
			if (detail.value !== 'goes-east' && detail.value !== 'goes-west') return;
			selectedWeatherSatellite = detail.value;
			return;
		}
		if (detail.layerId === 'lightning') {
			if (detail.controlId === 'heatmap') {
				if (typeof detail.value !== 'boolean') return;
				lightningHeatmapVisible = detail.value;
				return;
			}
			if (detail.controlId === 'strikes') {
				if (typeof detail.value !== 'boolean') return;
				lightningStrikesVisible = detail.value;
				return;
			}
			if (detail.controlId === 'satellite') {
				if (typeof detail.value !== 'string') return;
				if (detail.value !== 'all' && detail.value !== 'goes-east' && detail.value !== 'goes-west')
					return;
				selectedLightningSatellite = detail.value;
			}
		}
	}}
/>

<style>
	:global(body) {
		margin: 0;
		background: #0b1627;
		color: #e8f1ff;
		font-family: 'Avenir Next', Avenir, 'Segoe UI', sans-serif;
	}

	.landing {
		--panel: rgba(7, 16, 29, 0.62);
		--line: rgba(166, 198, 255, 0.22);
		--headline: #f5f8ff;
		--body: rgba(227, 238, 255, 0.9);
		--muted: rgba(203, 219, 247, 0.78);
		--accent: #ffc67f;
		--link: #ffd8ac;
		position: relative;
		z-index: 1;
		isolation: isolate;
		max-width: 72rem;
		margin: 0 auto;
		padding: 4rem 1.25rem 5.5rem;
		display: grid;
		gap: 1rem;
	}

	.hero {
		position: relative;
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 1.25rem;
		padding: 1.8rem;
		backdrop-filter: blur(8px);
		box-shadow: 0 18px 36px rgba(1, 6, 16, 0.32);
		animation: reveal 550ms ease-out both;
	}

	.eyebrow {
		margin: 0 0 0.75rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		font-weight: 700;
		font-size: 0.72rem;
		color: var(--accent);
	}

	h1 {
		margin: 0 0 1rem;
		font-size: clamp(2rem, 5vw, 3.25rem);
		line-height: 1.08;
		font-family: Georgia, 'Times New Roman', serif;
		color: var(--headline);
	}

	.intro {
		margin: 0;
		max-width: 60ch;
		line-height: 1.65;
		font-size: 1.04rem;
		color: var(--body);
	}

	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 1.5rem;
	}

	.links a {
		text-decoration: none;
		color: #e8f1ff;
		border: 1px solid var(--line);
		border-radius: 999px;
		padding: 0.45rem 0.9rem;
		font-size: 0.92rem;
		background: rgba(13, 27, 47, 0.42);
		transition:
			transform 140ms ease,
			background 140ms ease;
	}

	.links a:hover {
		transform: translateY(-1px);
		background: rgba(13, 27, 47, 0.62);
	}

	.collapse-cards {
		position: absolute;
		top: 0.8rem;
		right: 0.8rem;
		border: 1px solid var(--line);
		background: rgba(10, 24, 43, 0.7);
		color: #f5f8ff;
		border-radius: 999px;
		width: 2rem;
		height: 2rem;
		cursor: pointer;
		font-size: 1.1rem;
		line-height: 1;
	}

	.collapse-cards:hover {
		background: rgba(14, 31, 54, 0.92);
	}

	.card-restore-bar {
		position: fixed;
		left: 50%;
		bottom: 1.2rem;
		transform: translateX(-50%);
		z-index: 2;
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.restore-cards {
		border: 1px solid rgba(166, 198, 255, 0.34);
		background: rgba(7, 16, 29, 0.86);
		color: #f5f8ff;
		border-radius: 999px;
		padding: 0.52rem 1rem;
		font-size: 0.9rem;
		cursor: pointer;
		backdrop-filter: blur(8px);
	}

	.restore-cards:hover {
		background: rgba(12, 24, 42, 0.92);
	}

	.open-layers {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		border: 1px solid rgba(166, 198, 255, 0.3);
		background: rgba(7, 16, 29, 0.84);
		color: #f5f8ff;
		border-radius: 999px;
		padding: 0.52rem 1rem;
		font-size: 0.9rem;
		backdrop-filter: blur(8px);
		cursor: pointer;
	}

	.open-layers:hover {
		background: rgba(12, 24, 42, 0.92);
	}

	.content-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
		gap: 1rem;
	}

	.panel {
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 1.1rem;
		padding: 1.2rem 1.1rem;
		backdrop-filter: blur(8px);
		box-shadow: 0 18px 34px rgba(1, 6, 16, 0.28);
	}

	.section-heading h2 {
		margin: 0;
		font-size: clamp(1.18rem, 2.5vw, 1.48rem);
		font-family: Georgia, 'Times New Roman', serif;
		color: var(--headline);
	}

	.section-heading p {
		margin: 0.35rem 0 0;
		color: var(--muted);
		font-size: 0.94rem;
	}

	.project-list {
		list-style: none;
		margin: 1.1rem 0 0;
		padding: 0;
	}

	.project-item {
		padding: 0.95rem 0.05rem;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.8rem;
		border-top: 1px solid rgba(166, 198, 255, 0.18);
	}

	.project-item:first-child {
		border-top: 0;
		padding-top: 0.25rem;
	}

	.project-item h3 {
		margin: 0;
		font-size: 1.02rem;
		color: var(--headline);
	}

	.project-item p {
		margin: 0.35rem 0 0;
		line-height: 1.52;
		font-size: 0.93rem;
		color: var(--body);
	}

	.project-item a {
		width: fit-content;
		font-size: 0.86rem;
		text-decoration: none;
		color: var(--link);
		font-weight: 600;
		white-space: nowrap;
		padding-top: 0.2rem;
	}

	.project-item a:hover {
		color: #ffe8ca;
	}

	.musings {
		min-height: 100%;
	}

	.musings-empty {
		margin-top: 1rem;
		border: 1px dashed rgba(166, 198, 255, 0.26);
		border-radius: 0.8rem;
		padding: 0.95rem;
		color: var(--muted);
		background: rgba(9, 20, 36, 0.3);
		font-size: 0.92rem;
	}

	@keyframes reveal {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 40rem) {
		.landing {
			padding-top: 2.25rem;
		}

		.hero {
			padding: 1.4rem;
		}

		.project-item {
			flex-direction: column;
			gap: 0.55rem;
		}
	}

	@media (max-width: 56rem) {
		.content-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
