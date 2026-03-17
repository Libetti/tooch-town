<script lang="ts">
	import type { BaseLayerId, BaseMapOption } from '$lib/layers/layer-registry';

	type Props = {
		selectedBaseLayer: BaseLayerId;
		baseMaps: BaseMapOption[];
		onBaseLayerChange?: (detail: { value: BaseLayerId }) => void;
	};

	let { selectedBaseLayer, baseMaps, onBaseLayerChange }: Props = $props();
</script>

<section class="sidebar-section" aria-labelledby="base-map-title">
	<h3 id="base-map-title">Base Map</h3>
	<fieldset class="base-map-options">
		<legend class="sr-only">Base map options</legend>
		{#each baseMaps as option (option.id)}
			<label class="base-map-option sidebar-card">
				<input
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
		{/each}
	</fieldset>
</section>

<style>
	@import './common.css';
	@import './toggle-box.css';

	.base-map-options {
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.55rem;
		border: 0;
	}

	.base-map-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.55rem 0.7rem;
		font-size: 0.92rem;
	}
</style>
