<script lang="ts">
	import { PUBLIC_MAPTILER_KEY } from '$env/static/public';
	import { createLightningLayerController } from '$lib/lightning/lightning-layer-controller';
	import {
		createCmiRasterLayerController,
		type CmiRasterOverlay
	} from '$lib/weather/cmi-raster-layer-controller';
	import { createWeatherClockController } from '$lib/weather/weather-clock';
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
	import AuthPanel from '$lib/components/AuthPanel.svelte';
	import AuthTrigger from '$lib/components/AuthTrigger.svelte';
	import MapContainer from '$lib/components/MapContainer.svelte';
	import LayerSidebar from '$lib/components/LayerSidebar.svelte';
	import MusingsCard from '$lib/components/MusingsCard.svelte';
	import pipetteIcon from '$lib/assets/pipette-icon.svg';
	import { createMusing, listMusings } from '$lib/musings/api';
	import { sampleMusings } from '$lib/musings/sample-musings';
	import type { CreateMusingInput, Musing } from '$lib/musings/types';
	import { authProfile, authSession } from '$lib/supabase/auth';
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
	let weatherOverlay = $state<CmiRasterOverlay | undefined>(undefined);
	let weatherClockTime = $state(new Date());
	let weatherClockMinTime = $state(new Date());
	let weatherClockMaxTime = $state(new Date());
	let weatherClockPlaying = $state(false);
	let latestCmiTime = $state<Date | undefined>(undefined);
	let latestForecastTime = $state<Date | undefined>(undefined);
	let layerSidebarOpen = $state(false);
	let authExpanded = $state(false);
	let musingsExpanded = $state(false);
	let compactLayout = $state(false);
	let hasSupabaseAuthConfig = $derived.by(() => data.hasSupabaseAuthConfig);
	let musings = $state<Musing[]>([]);
	let musingsLoading = $state(true);
	let musingsError = $state<string | null>(null);
	let musingsCreatePending = $state(false);
	let removeMoonOrbitLayer: (() => void) | undefined;
	let spaceBattleLayerController: SpaceBattleLayerController | undefined;
	let mapRef: MapLibreMap | undefined;
	const projectsCollapsed = $derived(musingsExpanded && !compactLayout);

	const lightningLayerController = createLightningLayerController({
		frameApiPath: '/api/lightning/latest-frame',
		pointsApiPath: '/api/lightning/latest-points',
		pollIntervalMs: 15_000
	});
	const cmiRasterLayerController = createCmiRasterLayerController({
		apiPath: '/api/imagery/cmi/ch13/frames',
		satellite: 'goes-east',
		visible: false,
		frameLimit: 24,
		pollHintSeconds: 10
	});
	const weatherClockController = createWeatherClockController();

	const resolveBestWeatherNow = (): Date | undefined => {
		const candidates: number[] = [];
		if (weatherLayerEnabled && latestCmiTime) candidates.push(latestCmiTime.getTime());
		if (
			(precipitationLayerEnabled ||
				pressureLayerEnabled ||
				radarLayerEnabled ||
				temperatureLayerEnabled ||
				windLayerEnabled) &&
			latestForecastTime
		) {
			candidates.push(latestForecastTime.getTime());
		}
		if (candidates.length === 0) return undefined;
		return new Date(Math.min(...candidates));
	};

	const resolveWeatherClockRange = (): { min: Date; max: Date } => {
		const min = resolveBestWeatherNow() ?? latestForecastTime ?? latestCmiTime ?? new Date();
		const hasVisibleForecastLayer =
			precipitationLayerEnabled ||
			pressureLayerEnabled ||
			radarLayerEnabled ||
			temperatureLayerEnabled ||
			windLayerEnabled;
		const max =
			hasVisibleForecastLayer && latestForecastTime && latestForecastTime.getTime() >= min.getTime()
				? latestForecastTime
				: min;
		return { min, max };
	};

	$effect(() => {
		cmiRasterLayerController.setSatellite(selectedWeatherSatellite);
	});

	$effect(() => {
		cmiRasterLayerController.setVisible(weatherLayerEnabled);
	});

	$effect(() => {
		cmiRasterLayerController.setTime(weatherClockTime);
	});

	$effect(() => {
		weatherClockController.setNowReference(resolveBestWeatherNow());
	});

	$effect(() => {
		weatherClockController.setRange(resolveWeatherClockRange());
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

	$effect(() => {
		if (cardsCollapsed) musingsExpanded = false;
	});

	$effect(() => {
		if (cardsCollapsed) authExpanded = false;
	});

	const loadMusings = async () => {
		if (!hasSupabaseAuthConfig) {
			musings = sampleMusings;
			musingsLoading = false;
			musingsError = null;
			return;
		}

		musingsLoading = true;
		musingsError = null;

		const result = await listMusings();
		if (result.error || !result.data) {
			musingsError = result.error ?? 'Unable to load musings right now.';
			musingsLoading = false;
			return;
		}

		musings = result.data;
		musingsLoading = false;
	};

	const handleCreateMusing = async (input: CreateMusingInput) => {
		const currentSession = $authSession;
		if (!currentSession?.user) {
			musingsError = 'Sign in before publishing a thought.';
			authExpanded = true;
			return false;
		}

		musingsCreatePending = true;
		musingsError = null;

		const result = await createMusing(input);

		musingsCreatePending = false;

		if (result.error || !result.data) {
			musingsError = result.error ?? 'Unable to publish your thought right now.';
			return false;
		}

		musings = [result.data, ...musings.filter((musing) => musing.id !== result.data.id)];
		return true;
	};

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
		const compactLayoutMediaQuery = window.matchMedia('(max-width: 56rem)');
		const updateCompactLayout = () => {
			compactLayout = compactLayoutMediaQuery.matches;
		};

		updateCompactLayout();
		compactLayoutMediaQuery.addEventListener('change', updateCompactLayout);

		const unsubscribeWeather = cmiRasterLayerController.overlay.subscribe((overlay) => {
			weatherOverlay = overlay;
		});
		const unsubscribeWeatherClock = weatherClockController.subscribe((state) => {
			weatherClockTime = state.currentTime;
			weatherClockMinTime = state.minTime;
			weatherClockMaxTime = state.maxTime;
			weatherClockPlaying = state.playing;
		});
		const unsubscribeLatestCmiTime = cmiRasterLayerController.latestAvailableTime.subscribe((value) => {
			latestCmiTime = value;
		});
		cmiRasterLayerController.start();
		void loadMusings();

		return () => {
			compactLayoutMediaQuery.removeEventListener('change', updateCompactLayout);
			unsubscribeWeather();
			unsubscribeWeatherClock();
			unsubscribeLatestCmiTime();
			lightningLayerController.stop();
			cmiRasterLayerController.stop();
			weatherClockController.destroy();
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
			name: 'Lightning Rod',
			icon: '⚡',
			description:
				'A FastAPI server for exposing and transforming GOES-R Series data for web maps.',
			includes: [
				'Realtime GLM data providing latest strikes and frames for animation',
				'Cloud and Moisture Imagery (CMI) served as image overlays'
			],
			href: 'https://github.com/Libetti/lightning-rod',
			label: 'Check out repo'
		},
		{
			name: 'Pipette',
			icon: pipetteIcon,
			description: 'A chromium extension for grabbing colors from websites.',
			href: 'https://github.com/Libetti/pipette',
			label: 'Check out repo'
		},
		{
			name: 'My Flightfeeder',
			icon: '🛫',
			description: 'Live data view of my hosted FlightAware FlightFeeder',
			href: '/feeder',
			label: 'View feeder map'
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
				label: 'Watch those wrist wrockets!',
				enabled: spaceBattleLayerEnabled,
				description: 'Do it.'
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
	{weatherClockTime}
	{weatherClockMinTime}
	{weatherClockMaxTime}
	{weatherClockPlaying}
	weatherVisible={weatherLayerEnabled}
	{weatherOverlay}
	precipitationVisible={precipitationLayerEnabled}
	pressureVisible={pressureLayerEnabled}
	radarVisible={radarLayerEnabled}
	temperatureVisible={temperatureLayerEnabled}
	windVisible={windLayerEnabled}
	lightningLiveVisible={lightningLayerEnabled}
	onWeatherClockSetTime={(value) => {
		weatherClockController.setTime(value);
	}}
	onWeatherClockNow={() => {
		weatherClockController.jumpToNow();
	}}
	onWeatherClockTogglePlay={() => {
		if (weatherClockPlaying) {
			weatherClockController.pause();
			return;
		}
		weatherClockController.play();
	}}
	onForecastLatestTimeChange={(time) => {
		latestForecastTime = time;
	}}
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
	<div class="auth-dock">
		<AuthTrigger
			{hasSupabaseAuthConfig}
			expanded={authExpanded}
			onToggle={() => {
				authExpanded = !authExpanded;
			}}
		/>
	</div>
{/if}

<AuthPanel
	{hasSupabaseAuthConfig}
	expanded={authExpanded}
	onClose={() => {
		authExpanded = false;
	}}
/>

{#if !cardsCollapsed}
	<main class:landing--auth-open={authExpanded} class="landing">
		<section class="hero" aria-labelledby="about-title">
			<div class="hero-actions">
				<button
					type="button"
					class="collapse-cards"
					aria-label="Hide cards"
					onclick={() => {
						cardsCollapsed = true;
					}}>x</button
				>
			</div>
			<p class="eyebrow">Tooch Town</p>
			<h1 id="about-title">Anthony Libetti</h1>
			<p class="intro">
				Software Enginner at FlightAware <br />
				So you made it, welcome to my hood. Home to me, a map-fancy software engineer whose life mission
				is to continue to afford a series of stupid hobbies which end up abandoned. A Cayman GTS would
				be nice too...
			</p>
			<div class="links" aria-label="profile links">
				<a href="https://github.com/libetti" target="_blank" rel="noreferrer">GitHub</a>
				<a href="https://www.linkedin.com/in/libetti" target="_blank" rel="noreferrer">LinkedIn</a>
				<a href="mailto:anthony.libetti@yahoo.com" target="_blank" rel="noreferrer">Email</a>
			</div>
		</section>

		<div class:content-grid--musings-expanded={musingsExpanded} class="content-grid">
			<section
				class:projects--hidden={projectsCollapsed}
				class="panel projects"
				aria-labelledby="projects-title"
				aria-hidden={projectsCollapsed}
				inert={projectsCollapsed}
			>
				<div class="section-heading">
					<h2 id="projects-title">Some Projects</h2>
				</div>
				<ul class="project-list">
					{#each projects as project (project.name)}
						<li class="project-item">
							<div>
								<h3 class="project-title">
									{#if project.icon}
										{#if project.icon.includes('/')}
											<img
												class="project-title-icon"
												src={project.icon}
												alt=""
												aria-hidden="true"
											/>
										{:else}
											<span class="project-title-emoji" aria-hidden="true">{project.icon}</span>
										{/if}
									{/if}
									<span>{project.name}</span>
								</h3>
								<p>{project.description}</p>
								{#if project.includes}
									<ul class="project-includes">
										{#each project.includes as include}
											<li>{include}</li>
										{/each}
									</ul>
								{/if}
							</div>
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
							<a target="_blank" href={project.href}>{project.label}</a>
						</li>
					{/each}
				</ul>
			</section>

			<MusingsCard
				{musings}
				loading={musingsLoading}
				canAddThought={Boolean($authSession && hasSupabaseAuthConfig)}
				createPending={musingsCreatePending}
				errorMessage={musingsError}
				viewerLabel={$authProfile?.username ?? $authSession?.user?.email ?? null}
				onCreateThought={handleCreateMusing}
				onSignInRequest={() => {
					authExpanded = true;
				}}
				expanded={musingsExpanded}
				onToggle={() => {
					musingsExpanded = !musingsExpanded;
				}}
			/>
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
		--edge-gap: 1.25rem;
		--auth-panel-width: 30rem;
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
		max-width: none;
		width: min(calc(100% - (var(--edge-gap) * 2)), 72rem);
		margin: 0 auto;
		padding: 6.25rem 1.25rem 5.5rem;
		display: grid;
		gap: 1rem;
		transition:
			width 320ms cubic-bezier(0.16, 1, 0.3, 1),
			margin 320ms cubic-bezier(0.16, 1, 0.3, 1),
			padding 320ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.landing--auth-open {
		width: min(calc(100vw - var(--auth-panel-width) - (var(--edge-gap) * 2)), 72rem);
		margin-left: var(--edge-gap);
		margin-right: calc(var(--auth-panel-width) + var(--edge-gap));
	}

	.auth-dock {
		position: fixed;
		top: 1rem;
		right: 1rem;
		z-index: 6;
		display: grid;
		justify-items: end;
		gap: 0.75rem;
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
		transition:
			padding 320ms cubic-bezier(0.16, 1, 0.3, 1),
			box-shadow 320ms cubic-bezier(0.16, 1, 0.3, 1);
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

	.hero-actions {
		position: absolute;
		top: 0.8rem;
		right: 0.8rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.collapse-cards {
		border: 1px solid var(--line);
		background: rgba(10, 24, 43, 0.7);
		color: #f5f8ff;
		border-radius: 999px;
		cursor: pointer;
	}

	.collapse-cards {
		width: 2rem;
		height: 2rem;
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
		transition:
			grid-template-columns 320ms cubic-bezier(0.16, 1, 0.3, 1),
			gap 320ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.content-grid--musings-expanded {
		grid-template-columns: minmax(0, 0fr) minmax(0, 1fr);
		gap: 0;
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

	.project-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.project-title-emoji {
		font-size: 1.15rem;
		line-height: 1;
	}

	.project-title-icon {
		width: 1.15rem;
		height: 1.15rem;
		flex: 0 0 auto;
		display: block;
	}

	.project-item p {
		margin: 0.35rem 0 0;
		line-height: 1.52;
		font-size: 0.93rem;
		color: var(--body);
	}

	.project-includes {
		margin: 0.35rem 0 0;
		padding: 0;
		list-style: none;
		color: var(--body);
		font-size: 0.9rem;
		line-height: 1.5;
	}

	.project-includes li {
		position: relative;
		padding-left: 0.9rem;
	}

	.project-includes li::before {
		content: '•';
		position: absolute;
		left: 0;
		color: var(--accent);
	}

	.project-includes li + li {
		margin-top: 0.2rem;
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

	.projects {
		min-width: 0;
		overflow: clip;
		transition:
			opacity 240ms ease,
			transform 320ms cubic-bezier(0.16, 1, 0.3, 1),
			filter 240ms ease;
	}

	.projects--hidden {
		opacity: 0;
		transform: translateX(1.5rem) scale(0.98);
		filter: blur(10px);
		pointer-events: none;
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

	@media (max-width: 74.5rem) {
		.auth-dock {
			right: 2.5rem;
			left: auto;
		}
	}

	@media (max-width: 40rem) {
		.auth-dock {
			top: 0.85rem;
		}

		.landing--auth-open {
			width: min(calc(100% - (var(--edge-gap) * 2)), 72rem);
			margin: 0 auto;
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
		.landing {
			--auth-panel-width: 28rem;
		}

		.landing--auth-open {
			width: min(calc(100% - (var(--edge-gap) * 2)), 72rem);
			margin: 0 auto;
		}

		.content-grid {
			grid-template-columns: 1fr;
		}

		.content-grid--musings-expanded {
			gap: 1rem;
		}
	}
</style>
