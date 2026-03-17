<script lang="ts">
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
</script>

<section class="sidebar-section" aria-labelledby="data-layers-title">
	<h3 id="data-layers-title">Data Layers</h3>
	<div class="layer-list">
		{#each layers as layer (layer.id)}
			<article class="layer-card sidebar-card">
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
				</div>
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

	.layer-controls {
		display: grid;
		gap: 0.5rem;
	}
</style>
