<script lang="ts">
	export let visible = false;
	export let time = 'Loading weather timeline...';
	export let layerIds: string[] = [];
	export let playing = false;
	export let lightningLiveVisible = false;
	export let sliderValue = 0;
	export let sliderMin = 0;
	export let sliderMax = 0;
	export let sliderEnabled = false;
	export let onSliderInput: ((value: number) => void) | undefined = undefined;
	export let onTogglePlay: (() => void) | undefined = undefined;
	export let onNow: (() => void) | undefined = undefined;
	export let forecastDebugEntries: Array<{ label: string; time: string }> = [];
</script>

{#if visible}
	<aside class="weather-legend" aria-label="Weather animation key">
		<p class="weather-legend-title">Weather Sync Time</p>
		<p class="weather-legend-time">{time}</p>
		<div class="weather-legend-slider-wrap">
			<input
				type="range"
				class="weather-legend-slider"
				min={sliderMin}
				max={sliderMax}
				step="3600000"
				value={sliderValue}
				disabled={!sliderEnabled}
				aria-label="Weather forecast time range"
				oninput={(event) => onSliderInput?.(Number((event.currentTarget as HTMLInputElement).value))}
			/>
		</div>
		<div class="weather-legend-controls">
			<button type="button" class="weather-legend-button" aria-label={playing ? 'Pause weather playback' : 'Play weather playback'} onclick={onTogglePlay}>
				{playing ? 'Pause' : 'Play'}
			</button>
			<button type="button" class="weather-legend-button weather-legend-button--primary" aria-label="Jump weather to now" onclick={onNow}>
				Now
			</button>
		</div>
		<p class="weather-legend-layers-label">Layers:</p>
		<div class="weather-legend-layers">
			{#each layerIds as layerId (layerId)}
				<span class="weather-legend-layer-pill">{layerId}</span>
			{/each}
		</div>
		{#if forecastDebugEntries.length > 0}
			<p class="weather-legend-layers-label">Forecast Debug:</p>
			<div class="weather-legend-debug-list">
				{#each forecastDebugEntries as entry (entry.label)}
					<p class="weather-legend-debug-entry">
						<span>{entry.label}</span>
						<span>{entry.time}</span>
					</p>
				{/each}
			</div>
		{/if}
		{#if lightningLiveVisible}
			<p class="weather-legend-note">Lightning remains live now and is not synchronized to this clock.</p>
		{/if}
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
		pointer-events: auto;
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

	.weather-legend-controls {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin-top: 0.55rem;
	}

	.weather-legend-slider-wrap {
		margin-top: 0.55rem;
	}

	.weather-legend-slider {
		width: 100%;
		accent-color: rgba(105, 166, 255, 0.92);
	}

	.weather-legend-button {
		border: 1px solid rgba(173, 200, 240, 0.28);
		background: rgba(10, 24, 48, 0.58);
		color: rgba(235, 244, 255, 0.95);
		border-radius: 999px;
		padding: 0.28rem 0.62rem;
		font-size: 0.74rem;
		line-height: 1.2;
		cursor: pointer;
	}

	.weather-legend-button--primary {
		background: rgba(53, 107, 199, 0.72);
		border-color: rgba(138, 182, 255, 0.44);
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

	.weather-legend-debug-list {
		margin-top: 0.24rem;
		display: grid;
		gap: 0.18rem;
	}

	.weather-legend-debug-entry {
		margin: 0;
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		font-size: 0.72rem;
		line-height: 1.35;
		color: rgba(209, 226, 255, 0.82);
	}

	.weather-legend-note {
		margin: 0.45rem 0 0;
		font-size: 0.72rem;
		line-height: 1.35;
		color: rgba(209, 226, 255, 0.8);
	}

	@media (max-width: 640px) {
		.weather-legend {
			left: 50%;
			transform: translateX(-50%);
		}
	}
</style>
