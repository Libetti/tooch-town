<script lang="ts">
	export let visible = false;
	export let time = 'Loading weather timeline...';
	export let layerIds: string[] = [];
</script>

{#if visible}
	<aside class="weather-legend" aria-label="Weather animation key">
		<p class="weather-legend-title">Weather Forecast Time</p>
		<p class="weather-legend-time">{time}</p>
		<p class="weather-legend-layers-label">Layers:</p>
		<div class="weather-legend-layers">
			{#each layerIds as layerId (layerId)}
				<span class="weather-legend-layer-pill">{layerId}</span>
			{/each}
		</div>
	</aside>
{/if}

<style>
	.weather-legend {
		position: absolute;
		top: 1rem;
		left: 1rem;
		z-index: 4;
		width: min(22rem, calc(100vw - 2rem));
		padding: 0.6rem 0.75rem;
		border: 1px solid rgba(209, 226, 255, 0.35);
		border-radius: 0.6rem;
		background: linear-gradient(160deg, rgba(5, 14, 33, 0.9), rgba(8, 24, 52, 0.78));
		box-shadow: 0 0.75rem 1.8rem rgba(3, 8, 19, 0.4);
		backdrop-filter: blur(5px);
		pointer-events: none;
	}

	.weather-legend-title {
		margin: 0;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 0.8rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: rgba(209, 226, 255, 0.93);
	}

	.weather-legend-time {
		margin: 0.24rem 0 0;
		font-size: 0.9rem;
		font-weight: 600;
		color: #f7fbff;
	}

	.weather-legend-layers-label {
		margin: 0.24rem 0 0;
		font-size: 0.76rem;
		color: rgba(209, 226, 255, 0.9);
	}

	.weather-legend-layers {
		margin: 0.16rem 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		font-size: 0.76rem;
		color: rgba(209, 226, 255, 0.9);
	}

	.weather-legend-layer-pill {
		display: inline-flex;
		align-items: center;
		padding: 0.14rem 0.45rem;
		border-radius: 999px;
		border: 1px solid rgba(173, 200, 240, 0.28);
		background: rgba(10, 24, 48, 0.45);
		color: rgba(214, 230, 255, 0.88);
		font-size: 0.72rem;
		line-height: 1.2;
		letter-spacing: 0.01em;
	}
</style>
