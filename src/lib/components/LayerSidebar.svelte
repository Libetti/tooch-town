<script lang="ts">
	import { tick } from 'svelte';
	import BaseMapSection from '$lib/components/layer-sidebar/BaseMapSection.svelte';
	import DataLayersSection from '$lib/components/layer-sidebar/DataLayersSection.svelte';
	import type { BaseLayerId } from '$lib/maps/base-layer-ids';
	import type { LayerRegistry, WeatherSatelliteId } from '$lib/layers/layer-registry';

	type Props = {
		open?: boolean;
		selectedBaseLayer?: BaseLayerId;
		weatherEnabled?: boolean;
		selectedWeatherSatellite?: WeatherSatelliteId;
		registry?: LayerRegistry;
		onClose?: () => void;
		onBaseLayerChange?: (detail: { value: BaseLayerId }) => void;
		onLayerToggle?: (detail: { layerId: string; enabled: boolean }) => void;
		onLayerControlChange?: (detail: {
			layerId: string;
			controlId: string;
			value: string | number | boolean;
		}) => void;
	};

	let {
		open = false,
		selectedBaseLayer = 'satellite',
		registry = { baseMaps: [], layers: [] },
		onClose,
		onBaseLayerChange,
		onLayerToggle,
		onLayerControlChange
	}: Props = $props();

	let panelElement: HTMLElement | null = null;

	const focusableSelector =
		'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

	const closeSidebar = () => {
		onClose?.();
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

			<BaseMapSection
				baseMaps={registry.baseMaps}
				{selectedBaseLayer}
				{onBaseLayerChange}
			/>

			<DataLayersSection
				layers={registry.layers}
				{onLayerToggle}
				{onLayerControlChange}
			/>
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
