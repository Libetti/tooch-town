<script lang="ts">
	import type {
		ControlDefinition,
		SelectControlDefinition,
		SliderControlDefinition,
		ToggleControlDefinition
	} from '$lib/layers/layer-registry';

	type Props = {
		layerId: string;
		control: ControlDefinition;
		onLayerControlChange?: (detail: {
			layerId: string;
			controlId: string;
			value: string | number | boolean;
		}) => void;
	};

	let { layerId, control, onLayerControlChange }: Props = $props();

	const isSelectControl = (value: ControlDefinition): value is SelectControlDefinition => {
		return value.kind === 'select';
	};

	const isToggleControl = (value: ControlDefinition): value is ToggleControlDefinition => {
		return value.kind === 'toggle';
	};

	const isSliderControl = (value: ControlDefinition): value is SliderControlDefinition => {
		return value.kind === 'slider';
	};
</script>

{#if isSelectControl(control)}
	<label class="control-block sidebar-card" for={`control-${layerId}-${control.id}`}>
		<span>{control.label}</span>
		<select
			id={`control-${layerId}-${control.id}`}
			value={control.value}
			disabled={control.disabled}
			onchange={(event) => {
				onLayerControlChange?.({
					layerId,
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
	<label class="control-inline sidebar-card" for={`control-${layerId}-${control.id}`}>
		<input
			id={`control-${layerId}-${control.id}`}
			class="toggle-circle"
			type="checkbox"
			checked={control.value}
			disabled={control.disabled}
			oninput={(event) => {
				onLayerControlChange?.({
					layerId,
					controlId: control.id,
					value: (event.currentTarget as HTMLInputElement).checked
				});
			}}
		/>
		<span>{control.label}</span>
	</label>
{:else if isSliderControl(control)}
	<label class="control-block sidebar-card" for={`control-${layerId}-${control.id}`}>
		<span>{control.label}</span>
		<input
			id={`control-${layerId}-${control.id}`}
			type="range"
			min={control.min}
			max={control.max}
			step={control.step}
			value={control.value}
			disabled={control.disabled}
			oninput={(event) => {
				onLayerControlChange?.({
					layerId,
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

<style>
	@import './common.css';
	@import './toggle-box.css';

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
</style>
