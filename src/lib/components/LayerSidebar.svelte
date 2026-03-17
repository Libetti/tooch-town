<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import type {
		BaseLayerId,
		ControlDefinition,
		LayerRegistry,
		SelectControlDefinition,
		SliderControlDefinition,
		ToggleControlDefinition,
		WeatherSatelliteId
	} from '$lib/layers/layer-registry';

	type Props = {
		open?: boolean;
		selectedBaseLayer?: BaseLayerId;
		weatherEnabled?: boolean;
		selectedWeatherSatellite?: WeatherSatelliteId;
		registry?: LayerRegistry;
	};

	let {
		open = false,
		selectedBaseLayer = 'satellite',
		weatherEnabled = false,
		selectedWeatherSatellite = 'goes-east',
		registry = { baseMaps: [], layers: [] }
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		close: void;
		baseLayerChange: { value: BaseLayerId };
		layerToggle: { layerId: string; enabled: boolean };
		layerControlChange: { layerId: string; controlId: string; value: string | number | boolean };
	}>();

	let panelElement: HTMLElement | null = null;

	const focusableSelector =
		'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

	const closeSidebar = () => {
		dispatch('close');
	};

	const isSelectControl = (control: ControlDefinition): control is SelectControlDefinition => {
		return control.kind === 'select';
	};

	const isToggleControl = (control: ControlDefinition): control is ToggleControlDefinition => {
		return control.kind === 'toggle';
	};

	const isSliderControl = (control: ControlDefinition): control is SliderControlDefinition => {
		return control.kind === 'slider';
	};

	const focusFirstElement = () => {
		if (!panelElement) return;
		const focusableElements = Array.from(
			panelElement.querySelectorAll<HTMLElement>(focusableSelector)
		).filter((element) => !element.hasAttribute('disabled'));
		if (focusableElements.length > 0) {
			focusableElements[0].focus();
			return;
		}
		panelElement.focus();
	};

	const handlePanelKeydown = (event: KeyboardEvent) => {
		if (!open || !panelElement || event.key !== 'Tab') return;

		const focusableElements = Array.from(
			panelElement.querySelectorAll<HTMLElement>(focusableSelector)
		).filter((element) => !element.hasAttribute('disabled'));

		if (focusableElements.length === 0) {
			event.preventDefault();
			panelElement.focus();
			return;
		}

		const firstElement = focusableElements[0];
		const lastElement = focusableElements[focusableElements.length - 1];
		const activeElement = document.activeElement;

		if (event.shiftKey && activeElement === firstElement) {
			event.preventDefault();
			lastElement.focus();
			return;
		}

		if (!event.shiftKey && activeElement === lastElement) {
			event.preventDefault();
			firstElement.focus();
		}
	};

	const handleWindowKeydown = (event: KeyboardEvent) => {
		if (!open || event.key !== 'Escape') return;
		event.preventDefault();
		closeSidebar();
	};

	$effect(() => {
		if (!open) return;
		tick().then(() => {
			focusFirstElement();
		});
	});
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if open}
	<div class="layer-sidebar-root" data-testid="layer-sidebar">
		<button
			type="button"
			class="sidebar-backdrop"
			aria-label="Close layers panel"
			onclick={closeSidebar}
		></button>
		<aside
			bind:this={panelElement}
			class="sidebar-panel"
			role="dialog"
			aria-modal="true"
			aria-labelledby="layer-sidebar-title"
			tabindex="-1"
			onkeydown={handlePanelKeydown}
		>
			<header class="panel-header">
				<h2 id="layer-sidebar-title">Layers</h2>
				<button type="button" class="close-sidebar" onclick={closeSidebar}>Close Layers</button>
			</header>

			<section class="sidebar-section" aria-labelledby="base-map-title">
				<h3 id="base-map-title">Base Map</h3>
				<fieldset class="base-map-options">
					<legend class="sr-only">Base map options</legend>
					{#each registry.baseMaps as option (option.id)}
						<label class="base-map-option">
							<input
								class="toggle-box"
								type="radio"
								name="base-map"
								value={option.id}
								checked={selectedBaseLayer === option.id}
								onchange={() => {
									dispatch('baseLayerChange', { value: option.id });
								}}
							/>
							<span>{option.label}</span>
						</label>
					{/each}
				</fieldset>
			</section>

			<section class="sidebar-section" aria-labelledby="data-layers-title">
				<h3 id="data-layers-title">Data Layers</h3>
				<div class="layer-list">
					{#each registry.layers as layer (layer.id)}
						<article class="layer-card">
							<div class="layer-toggle-row">
								<label class="layer-toggle-label" for={`toggle-${layer.id}`}>
									<input
										id={`toggle-${layer.id}`}
										class="toggle-box"
										type="checkbox"
										checked={layer.enabled}
										oninput={(event) => {
											dispatch('layerToggle', {
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
										{#if isSelectControl(control)}
											<label class="control-block" for={`control-${layer.id}-${control.id}`}>
												<span>{control.label}</span>
												<select
													id={`control-${layer.id}-${control.id}`}
													value={control.value}
													disabled={control.disabled}
													onchange={(event) => {
														dispatch('layerControlChange', {
															layerId: layer.id,
															controlId: control.id,
															value: (event.currentTarget as HTMLSelectElement).value
														});
													}}
												>
													{#each control.options as option (option.value)}
														<option value={option.value}>{option.label}</option>
													{/each}
												</select>
											</label>
										{:else if isToggleControl(control)}
											<label class="control-inline" for={`control-${layer.id}-${control.id}`}>
												<input
													id={`control-${layer.id}-${control.id}`}
													class="toggle-box"
													type="checkbox"
													checked={control.value}
													disabled={control.disabled}
													oninput={(event) => {
														dispatch('layerControlChange', {
															layerId: layer.id,
															controlId: control.id,
															value: (event.currentTarget as HTMLInputElement).checked
														});
													}}
												/>
												<span>{control.label}</span>
											</label>
										{:else if isSliderControl(control)}
											<label class="control-block" for={`control-${layer.id}-${control.id}`}>
												<span>{control.label}</span>
												<input
													id={`control-${layer.id}-${control.id}`}
													type="range"
													min={control.min}
													max={control.max}
													step={control.step}
													value={control.value}
													disabled={control.disabled}
													oninput={(event) => {
														dispatch('layerControlChange', {
															layerId: layer.id,
															controlId: control.id,
															value: Number((event.currentTarget as HTMLInputElement).value)
														});
													}}
												/>
											</label>
										{/if}
										{#if control.description}
											<p class="control-description">{control.description}</p>
										{/if}
									{/each}
								</div>
							{/if}
						</article>
					{/each}
				</div>
			</section>
		</aside>
	</div>
{/if}

<style>
	.layer-sidebar-root {
		position: fixed;
		inset: 0;
		z-index: 4;
	}

	.sidebar-backdrop {
		position: absolute;
		inset: 0;
		border: 0;
		background: rgba(2, 7, 15, 0.52);
		animation: sidebar-fade 180ms ease-out;
	}

	.sidebar-panel {
		--line: rgba(166, 198, 255, 0.28);
		--panel: rgba(7, 16, 29, 0.95);
		position: absolute;
		top: 0;
		right: 0;
		height: 100%;
		width: min(24rem, 92vw);
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem;
		background: var(--panel);
		border-left: 1px solid var(--line);
		backdrop-filter: blur(12px);
		box-shadow: -12px 0 30px rgba(1, 6, 16, 0.35);
		overflow: auto;
		animation: sidebar-slide-in 220ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
	}

	.panel-header h2 {
		margin: 0;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 1.35rem;
	}

	.close-sidebar {
		border: 1px solid var(--line);
		border-radius: 999px;
		background: rgba(12, 24, 42, 0.95);
		color: #f5f8ff;
		font-size: 0.84rem;
		padding: 0.35rem 0.75rem;
		cursor: pointer;
	}

	.sidebar-section {
		display: grid;
		gap: 0.7rem;
	}

	.sidebar-section h3 {
		margin: 0;
		font-size: 0.95rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(229, 239, 255, 0.84);
	}

	.base-map-options {
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.55rem;
		border: 0;
	}

	.base-map-option,
	.layer-card,
	.control-inline,
	.control-block {
		border: 1px solid var(--line);
		background: rgba(10, 22, 39, 0.82);
		border-radius: 0.75rem;
	}

	.base-map-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.55rem 0.7rem;
		font-size: 0.92rem;
	}

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

	.toggle-box {
		appearance: none;
		-webkit-appearance: none;
		width: 0.95rem;
		height: 0.95rem;
		border-radius: 0.22rem;
		border: 1px solid rgba(166, 198, 255, 0.55);
		background: rgba(12, 24, 42, 0.9);
		cursor: pointer;
		transition:
			background-color 140ms ease,
			border-color 140ms ease,
			box-shadow 140ms ease;
	}

	.toggle-box:checked {
		background: #34bf73;
		border-color: #34bf73;
		box-shadow: 0 0 0 2px rgba(52, 191, 115, 0.24);
	}

	.toggle-box:focus-visible {
		outline: 2px solid rgba(52, 191, 115, 0.85);
		outline-offset: 2px;
	}

	.toggle-box:disabled {
		opacity: 0.55;
		cursor: not-allowed;
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

	.control-inline,
	.control-block {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.5rem 0.6rem;
		font-size: 0.84rem;
	}

	.control-block {
		flex-direction: column;
		align-items: flex-start;
	}

	.control-block input,
	.control-block select {
		accent-color: #ffc67f;
	}

	.control-block select,
	.control-block input[type='range'] {
		width: 100%;
	}

	.control-block select {
		background: rgba(12, 24, 42, 0.95);
		color: #f5f8ff;
		border: 1px solid rgba(166, 198, 255, 0.35);
		border-radius: 0.6rem;
		padding: 0.35rem 0.5rem;
		font-size: 0.84rem;
	}

	.control-description {
		margin: -0.25rem 0 0;
		font-size: 0.76rem;
		color: rgba(214, 228, 250, 0.72);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	@keyframes sidebar-slide-in {
		from {
			transform: translateX(100%);
		}
		to {
			transform: translateX(0);
		}
	}

	@keyframes sidebar-fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@media (max-width: 40rem) {
		.sidebar-panel {
			top: auto;
			bottom: 0;
			left: 0;
			right: 0;
			width: 100%;
			height: auto;
			max-height: 78vh;
			border-left: 0;
			border-top: 1px solid var(--line);
			border-radius: 1rem 1rem 0 0;
			animation-name: sidebar-slide-up;
		}
	}

	@keyframes sidebar-slide-up {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sidebar-panel,
		.sidebar-backdrop {
			animation: none;
		}
	}
</style>
