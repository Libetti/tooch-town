import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import LayerSidebar from './LayerSidebar.svelte';
import type { LayerRegistry } from '$lib/layers/layer-registry';

const makeRegistry = (weatherEnabled = false): LayerRegistry => ({
	baseMaps: [
		{ id: 'satellite', label: 'Satellite' },
		{ id: 'streets', label: 'Streets' }
	],
	layers: [
		{
			id: 'weather-cmi',
			label: 'Weather',
			enabled: weatherEnabled,
			controls: [
				{
					kind: 'select',
					id: 'satellite',
					label: 'Satellite Feed',
					value: 'goes-east',
					disabled: !weatherEnabled,
					options: [
						{ value: 'goes-east', label: 'GOES-East' },
						{ value: 'goes-west', label: 'GOES-West' }
					]
				}
			]
		}
	]
});

describe('LayerSidebar', () => {
	it('renders registry data and emits payloads for layer interactions', async () => {
		const baseLayerChanges: Array<{ value: string }> = [];
		const layerToggles: Array<{ layerId: string; enabled: boolean }> = [];
		const controlChanges: Array<{ layerId: string; controlId: string; value: string | number | boolean }> = [];

		const view = render(LayerSidebar, {
			open: true,
			selectedBaseLayer: 'satellite',
			weatherEnabled: false,
			selectedWeatherSatellite: 'goes-east',
			registry: makeRegistry(false)
		});

		view.component.$on('baseLayerChange', (event: CustomEvent<{ value: string }>) => {
			baseLayerChanges.push(event.detail);
		});
		view.component.$on('layerToggle', (event: CustomEvent<{ layerId: string; enabled: boolean }>) => {
			layerToggles.push(event.detail);
		});
		view.component.$on(
			'layerControlChange',
			(event: CustomEvent<{ layerId: string; controlId: string; value: string | number | boolean }>) => {
				controlChanges.push(event.detail);
			}
		);

		await expect.element(page.getByRole('dialog', { name: 'Layers' })).toBeInTheDocument();
		await expect.element(page.getByRole('radio', { name: 'Satellite' })).toBeInTheDocument();
		await expect.element(page.getByRole('radio', { name: 'Streets' })).toBeInTheDocument();

		await page.getByRole('radio', { name: 'Streets' }).click();
		await page.getByRole('checkbox', { name: 'Weather' }).click();

		await view.rerender({
			open: true,
			selectedBaseLayer: 'streets',
			weatherEnabled: true,
			selectedWeatherSatellite: 'goes-east',
			registry: makeRegistry(true)
		});

		const satelliteSelect = page.getByLabelText('Satellite Feed');
		await expect.element(satelliteSelect).toBeEnabled();
		await satelliteSelect.selectOption('goes-west');

		expect(baseLayerChanges).toEqual([{ value: 'streets' }]);
		expect(layerToggles).toEqual([{ layerId: 'weather-cmi', enabled: true }]);
		expect(controlChanges).toEqual([
			{ layerId: 'weather-cmi', controlId: 'satellite', value: 'goes-west' }
		]);
	});
});
