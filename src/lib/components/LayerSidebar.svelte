<script lang="ts">
	import { tick } from 'svelte';
	import BaseMapSection from '$lib/components/layer-sidebar/BaseMapSection.svelte';
	import DataLayersSection from '$lib/components/layer-sidebar/DataLayersSection.svelte';
	import type { BaseLayerId } from '$lib/maps/base-layer-ids';
	import type { LayerRegistry } from '$lib/layers/layer-registry';

	type Props = {
		open?: boolean;
		selectedBaseLayer?: BaseLayerId;
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
		selectedBaseLayer = 'voyager-v2-darkmatter',
		registry = { baseMaps: [], layers: [] },
		onClose,
		onBaseLayerChange,
		onLayerToggle,
		onLayerControlChange
	}: Props = $props();

	let panelElement = $state<HTMLElement | null>(null);
	let mobilePanelHeight = $state<number | null>(null);

	const focusableSelector =
		'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
	const MOBILE_BREAKPOINT = '(max-width: 40rem)';
	const MOBILE_MIN_HEIGHT = 280;
	const MOBILE_MAX_HEIGHT_RATIO = 0.92;
	const MOBILE_DEFAULT_HEIGHT_RATIO = 0.78;

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

	const isMobileLayout = () =>
		typeof window !== 'undefined' && window.matchMedia(MOBILE_BREAKPOINT).matches;

	const clampMobileHeight = (height: number) => {
		const viewportHeight = window.innerHeight;
		const minHeight = Math.min(MOBILE_MIN_HEIGHT, viewportHeight * 0.75);
		const maxHeight = viewportHeight * MOBILE_MAX_HEIGHT_RATIO;
		return Math.min(Math.max(height, minHeight), maxHeight);
	};

	const setDefaultMobileHeight = () => {
		if (!isMobileLayout()) {
			mobilePanelHeight = null;
			return;
		}

		mobilePanelHeight = clampMobileHeight(window.innerHeight * MOBILE_DEFAULT_HEIGHT_RATIO);
	};

	const handleMobileResizeStart = (event: PointerEvent) => {
		if (!isMobileLayout()) return;

		const handleElement = event.currentTarget as HTMLElement | null;
		if (!handleElement) return;

		const startY = event.clientY;
		const startHeight =
			mobilePanelHeight ?? clampMobileHeight(window.innerHeight * MOBILE_DEFAULT_HEIGHT_RATIO);

		handleElement.setPointerCapture(event.pointerId);

		const handlePointerMove = (moveEvent: PointerEvent) => {
			mobilePanelHeight = clampMobileHeight(startHeight + (startY - moveEvent.clientY));
		};

		const handlePointerEnd = () => {
			handleElement.removeEventListener('pointermove', handlePointerMove);
			handleElement.removeEventListener('pointerup', handlePointerEnd);
			handleElement.removeEventListener('pointercancel', handlePointerEnd);
		};

		handleElement.addEventListener('pointermove', handlePointerMove);
		handleElement.addEventListener('pointerup', handlePointerEnd);
		handleElement.addEventListener('pointercancel', handlePointerEnd);
	};

	$effect(() => {
		if (!open) return;
		setDefaultMobileHeight();
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
		<div
			bind:this={panelElement}
			class="sidebar-panel"
			style:--mobile-panel-height={mobilePanelHeight ? `${mobilePanelHeight}px` : null}
			role="dialog"
			aria-modal="true"
			aria-labelledby="layer-sidebar-title"
			tabindex="-1"
			onkeydown={handlePanelKeydown}
		>
			<div class="mobile-top-chrome">
				<div
					class="mobile-resize-handle"
					aria-hidden="true"
					onpointerdown={handleMobileResizeStart}
				>
					<span class="mobile-resize-grip"></span>
				</div>
				<header class="panel-header">
					<h2 id="layer-sidebar-title">Layers</h2>
					<button type="button" class="close-sidebar" onclick={closeSidebar}>X</button>
				</header>
			</div>

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
		</div>
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
		background: transparent;
		animation: sidebar-fade 180ms ease-out;
	}

	.sidebar-panel {
		--line: rgba(166, 198, 255, 0.28);
		--mobile-panel-height: 78vh;
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

	.mobile-resize-handle {
		display: none;
	}

	.mobile-top-chrome {
		display: contents;
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
		font-size: 0.82rem;
		font-weight: 500;
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		line-height: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
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
			height: var(--mobile-panel-height);
			max-height: 92vh;
			border-left: 0;
			border-top: 1px solid var(--line);
			border-radius: 1rem 1rem 0 0;
			animation-name: sidebar-slide-up;
		}

		.mobile-top-chrome {
			position: sticky;
			top: -1rem;
			z-index: 2;
			display: block;
			margin: -1rem -1rem 0;
			padding: 0 1rem 0.75rem;
			background: var(--panel);
			border-radius: 1rem 1rem 0 0;
		}

		.mobile-resize-handle {
			display: flex;
			justify-content: center;
			padding: 0.6rem 0 0.45rem;
			margin: 0;
			touch-action: none;
			cursor: ns-resize;
		}

		.mobile-resize-grip {
			width: 3rem;
			height: 0.3rem;
			border-radius: 999px;
			background: rgba(227, 238, 255, 0.34);
		}

		.panel-header {
			margin: 0;
			padding: 0;
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
