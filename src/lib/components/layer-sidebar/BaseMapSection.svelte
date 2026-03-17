<script lang="ts">
	import { linear } from 'svelte/easing';
	import { slide } from 'svelte/transition';
	import type { BaseLayerId } from '$lib/maps/base-layer-ids';
	import type { BaseMapOption } from '$lib/layers/layer-registry';

	type Props = {
		selectedBaseLayer: BaseLayerId;
		baseMaps: BaseMapOption[];
		onBaseLayerChange?: (detail: { value: BaseLayerId }) => void;
	};

	let { selectedBaseLayer, baseMaps, onBaseLayerChange }: Props = $props();
	let expandedDetailIds = $state<BaseLayerId[]>([]);
	const selectedBaseMapLabel = $derived(
		baseMaps.find((baseMap) => baseMap.id === selectedBaseLayer)?.label ?? selectedBaseLayer
	);

	const isDetailsOpen = (baseLayerId: BaseLayerId): boolean => {
		return expandedDetailIds.includes(baseLayerId);
	};

	const toggleDetails = (baseLayerId: BaseLayerId) => {
		if (isDetailsOpen(baseLayerId)) {
			expandedDetailIds = expandedDetailIds.filter((id) => id !== baseLayerId);
			return;
		}
		expandedDetailIds = [...expandedDetailIds, baseLayerId];
	};
</script>

<section class="sidebar-section" aria-labelledby="base-map-title">
	<h3 id="base-map-title">Base Map - {selectedBaseMapLabel}</h3>
	<fieldset class="base-map-options">
		<legend class="sr-only">Base map options</legend>
		{#each baseMaps as option (option.id)}
			<div class="base-map-option sidebar-card" class:expanded={isDetailsOpen(option.id)}>
				<div class="base-map-option-row">
					<label
						class="base-map-option-main"
						class:selected={selectedBaseLayer === option.id}
						for={`base-map-${option.id}`}
					>
						<input
							id={`base-map-${option.id}`}
							class="toggle-circle"
							type="radio"
							name="base-map"
							value={option.id}
							checked={selectedBaseLayer === option.id}
							onchange={() => {
								onBaseLayerChange?.({ value: option.id });
							}}
						/>
						<span>{option.label}</span>
					</label>
					<button
						type="button"
						class="details-toggle"
						aria-expanded={isDetailsOpen(option.id)}
						onclick={(event) => {
							event.preventDefault();
							event.stopPropagation();
							toggleDetails(option.id);
						}}
					>
						Details
					</button>
					</div>
					{#if isDetailsOpen(option.id) && option.description}
						<div
							class="base-map-details"
							transition:slide={{ duration: 160, easing: linear }}
						>
							<p class="base-map-description">{option.description}</p>
						</div>
					{/if}
				</div>
			{/each}
		</fieldset>
</section>

<style>
	@import './common.css';
	@import './toggle-box.css';

	.base-map-options {
		--visible-options: 5;
		--option-height: 2.35rem;
		--peek-next-option: 0.9rem;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.55rem;
		border: 0;
		max-height: calc(
			(var(--visible-options) * var(--option-height)) +
				((var(--visible-options) - 1) * 0.55rem) +
				var(--peek-next-option)
		);
		overflow-y: hidden;
		padding-right: 0.15rem;
		scrollbar-gutter: stable;
	}

	.base-map-options:hover,
	.base-map-options:focus-within {
		overflow-y: auto;
	}

	.base-map-option {
		display: grid;
		padding: 0.55rem 0.7rem;
		min-height: var(--option-height);
		height: min-content;
		font-size: 0.92rem;
		align-content: start;
		transition: padding-bottom 160ms linear;
	}

	.base-map-option-row {
		display: flex;
		align-items: center;
		gap: 0.55rem;
	}

	.base-map-option-main {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		flex: 1 1 auto;
	}

	#base-map-title {
		color: #ffc67f;
	}

	.base-map-option-main.selected {
		color: #ffc67f;
	}

	.base-map-option-main .toggle-circle:checked {
		background: #ffc67f;
		border-color: #ffc67f;
		box-shadow: 0 0 0 2px rgba(255, 198, 127, 0.28);
	}

	.base-map-option-main .toggle-circle:focus-visible {
		outline: 2px solid rgba(255, 198, 127, 0.9);
	}

	.details-toggle {
		margin-left: auto;
		border: 1px solid rgba(166, 198, 255, 0.32);
		background: rgba(9, 22, 40, 0.55);
		color: rgba(223, 236, 255, 0.95);
		border-radius: 999px;
		font-size: 0.72rem;
		padding: 0.1rem 0.45rem;
		cursor: pointer;
		white-space: nowrap;
	}

	.details-toggle:hover {
		background: rgba(11, 29, 52, 0.8);
	}

	.base-map-option.expanded {
		padding-bottom: 0.62rem;
	}

	.base-map-details {
		margin-top: 0.45rem;
	}

	.base-map-description {
		margin: 0;
		color: rgba(211, 226, 248, 0.9);
		font-size: 0.8rem;
		line-height: 1.35;
	}
</style>
