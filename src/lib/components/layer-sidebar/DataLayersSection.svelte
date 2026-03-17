<script lang="ts">
	import { linear } from 'svelte/easing';
	import { slide } from 'svelte/transition';
	import LayerControlField from './LayerControlField.svelte';
	import type { LayerDefinition } from '$lib/layers/layer-registry';

	type Props = {
		layers: LayerDefinition[];
		onLayerToggle?: (detail: { layerId: string; enabled: boolean }) => void;
		onLayerControlChange?: (detail: {
			layerId: string;
			controlId: string;
			value: string | number | boolean;
		}) => void;
	};

	let { layers, onLayerToggle, onLayerControlChange }: Props = $props();
	let expandedOptionLayerIds = $state<string[]>([]);

	const isOptionsOpen = (layerId: string): boolean => {
		return expandedOptionLayerIds.includes(layerId);
	};

	const toggleOptions = (layerId: string): void => {
		if (isOptionsOpen(layerId)) {
			expandedOptionLayerIds = expandedOptionLayerIds.filter((id) => id !== layerId);
			return;
		}
		expandedOptionLayerIds = [...expandedOptionLayerIds, layerId];
	};
</script>

<section class="sidebar-section" aria-labelledby="data-layers-title">
	<h3 id="data-layers-title">Data Layers</h3>
	<div class="layer-list">
		{#each layers as layer (layer.id)}
			<article class="layer-card sidebar-card" class:expanded={isOptionsOpen(layer.id)}>
				<div class="layer-toggle-row">
					<label class="layer-toggle-label" for={`toggle-${layer.id}`}>
						<input
							id={`toggle-${layer.id}`}
							class="toggle-circle"
							type="checkbox"
							checked={layer.enabled}
							oninput={(event) => {
								onLayerToggle?.({
									layerId: layer.id,
									enabled: (event.currentTarget as HTMLInputElement).checked
								});
							}}
						/>
						<span>{layer.label}</span>
					</label>
					<button
						type="button"
						class="details-toggle"
						aria-expanded={isOptionsOpen(layer.id)}
						onclick={(event) => {
							event.preventDefault();
							event.stopPropagation();
							toggleOptions(layer.id);
						}}
					>
						Options
					</button>
				</div>
				{#if isOptionsOpen(layer.id)}
					<div class="layer-options" transition:slide={{ duration: 160, easing: linear }}>
						{#if layer.description}
							<p class="layer-description">{layer.description}</p>
						{/if}
						{#if layer.controls && layer.controls.length > 0}
							<div class="layer-controls">
								{#each layer.controls as control (control.id)}
									<LayerControlField
										layerId={layer.id}
										{control}
										{onLayerControlChange}
									/>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			</article>
		{/each}
	</div>
</section>

<style>
	@import './common.css';
	@import './toggle-box.css';

	.layer-list {
		display: grid;
		gap: 0.65rem;
	}

	.layer-card {
		display: grid;
		gap: 0.55rem;
		padding: 0.65rem 0.75rem;
		transition: padding-bottom 160ms linear;
	}

	.layer-toggle-row {
		display: flex;
		justify-content: flex-start;
		align-items: center;
	}

	.layer-toggle-label {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		font-size: 0.92rem;
		font-weight: 600;
	}

	.layer-description {
		margin: 0;
		font-size: 0.82rem;
		color: rgba(214, 228, 250, 0.78);
	}

	.layer-card.expanded {
		padding-bottom: 0.62rem;
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

	.layer-options {
		display: grid;
		gap: 0.5rem;
	}

	.layer-controls {
		display: grid;
		gap: 0.5rem;
	}
</style>
