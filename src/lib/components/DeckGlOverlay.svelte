<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy } from 'svelte';
	import type { DeckProps } from '@deck.gl/core';
	import type { MapboxOverlay as MapboxOverlayType } from '@deck.gl/mapbox';
	import type { Map } from 'maplibre-gl';

	export let map: Map | undefined = undefined;
	export let layers: DeckProps['layers'] = [];
	export let effects: DeckProps['effects'] = [];
	export let interleaved = true;
	export let animate = true;

	let overlay: MapboxOverlayType | undefined;
	let overlayMap: Map | undefined;

	const deckProps = (): DeckProps => ({
		layers,
		effects,
		_animate: animate
	});

	const detachOverlay = () => {
		if (overlay && overlayMap) {
			overlayMap.removeControl(overlay);
		}

		overlay = undefined;
		overlayMap = undefined;
	};

	const attachOverlay = async (targetMap: Map) => {
		if (overlay && overlayMap === targetMap) {
			overlay.setProps({ interleaved, ...deckProps() });
			return;
		}

		detachOverlay();

		const { MapboxOverlay } = await import('@deck.gl/mapbox');
		if (map !== targetMap) return;

		overlay = new MapboxOverlay({ interleaved, ...deckProps() });
		targetMap.addControl(overlay);
		overlayMap = targetMap;
	};

	$: if (browser && map) {
		void attachOverlay(map);
	}

	$: if (!map) {
		detachOverlay();
	}

	$: if (overlay) {
		overlay.setProps({ interleaved, ...deckProps() });
	}

	onDestroy(() => {
		detachOverlay();
	});
</script>
