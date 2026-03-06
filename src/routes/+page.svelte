<script lang="ts">
	import { dev } from '$app/environment';
	import {
		_SunLight as SunLight,
		AmbientLight,
		LightingEffect,
		type DeckProps
	} from '@deck.gl/core';
	import { onMount } from 'svelte';
	import DeckGlOverlay from '$lib/components/DeckGlOverlay.svelte';
	import SpinningGlobeBackground from '$lib/components/SpinningGlobeBackground.svelte';
	import { buildRainLineLayer } from '$lib/weather/rainLayer';
	import {
		buildFallbackPrecipCells,
		DEFAULT_RAIN_LAYER_CONFIG,
		createRainAnimationState,
		updateRainAnimationState,
		type PrecipCell
	} from '$lib/weather/precipitation';
	import type { Map as MapLibreMap } from 'maplibre-gl';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let globeMap = $state<MapLibreMap | undefined>(undefined);
	let rainCells = $state<PrecipCell[]>([]);
	let deckLayers = $state<NonNullable<DeckProps['layers']>>([]);
	let rainAnimationState = $state(createRainAnimationState(DEFAULT_RAIN_LAYER_CONFIG));
	let rainFetchIntervalId: number | undefined;
	let rainAnimationFrameId: number | undefined;
	let lastFrameTimestamp = 0;
	let lastRainLayerBuild = 0;
	let cardsCollapsed = $state(false);

	const ambientLight = new AmbientLight({
		color: [255, 255, 255],
		intensity: 0.3
	});

	const sunLight = new SunLight({
		color: [255, 255, 255],
		intensity: 1,
		timestamp: Date.now()
	});

	const deckEffects = [new LightingEffect({ ambientLight, sunLight })];
	const RAIN_POLL_INTERVAL_MS = 180_000;
	const RAIN_LAYER_REBUILD_INTERVAL_MS = 16;

	type PrecipGridResponse = {
		generatedAt: string;
		ttlSeconds: number;
		cells: PrecipCell[];
	};

	const handleMapReady = (map: MapLibreMap) => {
		globeMap = map;
	};

	const rebuildRainLayer = (timestampMs: number, force = false) => {
		if (lastFrameTimestamp > 0) {
			rainAnimationState = updateRainAnimationState(
				rainAnimationState,
				timestampMs - lastFrameTimestamp,
				DEFAULT_RAIN_LAYER_CONFIG
			);
		}
		lastFrameTimestamp = timestampMs;

		if (!force && timestampMs - lastRainLayerBuild < RAIN_LAYER_REBUILD_INTERVAL_MS) {
			return;
		}

		const rainLayer = buildRainLineLayer(
			rainCells,
			timestampMs / 1000,
			rainAnimationState,
			DEFAULT_RAIN_LAYER_CONFIG
		);
		deckLayers = rainLayer ? [rainLayer] : [];
		lastRainLayerBuild = timestampMs;
	};

	const tickRain = (timestampMs: number) => {
		rebuildRainLayer(timestampMs);
		rainAnimationFrameId = window.requestAnimationFrame(tickRain);
	};

	const fetchRainGrid = async () => {
		try {
			const response = await fetch('/api/weather/precip-grid', {
				headers: { accept: 'application/json' }
			});
			if (!response.ok) return;

			const payload = (await response.json()) as PrecipGridResponse;
			const liveCells = Array.isArray(payload.cells) ? payload.cells : [];
			rainCells = liveCells.length ? liveCells : buildFallbackPrecipCells();
			if (dev) {
				console.info('[rain] grid update', {
					cells: liveCells.length,
					renderedCells: rainCells.length,
					usingFallback: liveCells.length === 0,
					thresholdMmPerHour: rainAnimationState.activeMinPrecipMmPerHour
				});
			}
			rebuildRainLayer(performance.now(), true);
		} catch {
			// Keep rendering with previously fetched precipitation.
		}
	};

	onMount(() => {
		lastRainLayerBuild = -RAIN_LAYER_REBUILD_INTERVAL_MS;
		void fetchRainGrid();

		rainFetchIntervalId = window.setInterval(() => {
			void fetchRainGrid();
		}, RAIN_POLL_INTERVAL_MS);

		rainAnimationFrameId = window.requestAnimationFrame(tickRain);

		return () => {
			if (rainFetchIntervalId !== undefined) window.clearInterval(rainFetchIntervalId);
			if (rainAnimationFrameId !== undefined) window.cancelAnimationFrame(rainAnimationFrameId);
		};
	});

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
</script>

<svelte:head>
	<title>Anthony Libetti | Tooch Town</title>
	<meta
		name="description"
		content="Personal landing page for Anthony Libetti and the projects being built in Tooch Town."
	/>
</svelte:head>

<SpinningGlobeBackground
	center={data.initialCenter}
	zoom={2.5}
	pitch={0}
	spinDegreesPerSecond={0.6}
	interactionsEnabled={cardsCollapsed}
	onMapReady={handleMapReady}
/>

{#if globeMap}
	<DeckGlOverlay map={globeMap} layers={deckLayers} effects={deckEffects} />
{/if}

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
			}}>Open Cards</button
		>
	</div>
{/if}

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
