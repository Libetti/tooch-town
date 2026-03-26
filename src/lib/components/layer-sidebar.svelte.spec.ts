import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import LayerSidebar from './LayerSidebar.svelte';
import type { LayerRegistry } from '$lib/layers/layer-registry';

const makeRegistry = (weatherEnabled = false, precipitationEnabled = true): LayerRegistry => ({
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
		},
		{
			id: 'weather-precipitation',
			label: 'Precipitation',
			enabled: precipitationEnabled
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
				registry: makeRegistry(false),
				onBaseLayerChange: (detail: { value: string }) => {
					baseLayerChanges.push(detail);
			},
			onLayerToggle: (detail: { layerId: string; enabled: boolean }) => {
				layerToggles.push(detail);
			},
			onLayerControlChange: (detail: {
				layerId: string;
				controlId: string;
				value: string | number | boolean;
			}) => {
				controlChanges.push(detail);
			}
		});

		await expect.element(page.getByRole('dialog', { name: 'Layers' })).toBeInTheDocument();
		await expect.element(page.getByRole('radio', { name: 'Satellite' })).toBeInTheDocument();
		await expect.element(page.getByRole('radio', { name: 'Streets' })).toBeInTheDocument();

		await page.getByRole('radio', { name: 'Streets' }).click();
		await page.getByRole('checkbox', { name: 'Weather' }).click();
		await page.getByRole('checkbox', { name: 'Precipitation' }).click();
		await page.getByRole('button', { name: 'Options' }).nth(0).click();

			await view.rerender({
				open: true,
				selectedBaseLayer: 'streets',
				registry: makeRegistry(true),
				onBaseLayerChange: (detail: { value: string }) => {
					baseLayerChanges.push(detail);
			},
			onLayerToggle: (detail: { layerId: string; enabled: boolean }) => {
				layerToggles.push(detail);
			},
			onLayerControlChange: (detail: {
				layerId: string;
				controlId: string;
				value: string | number | boolean;
			}) => {
				controlChanges.push(detail);
			}
		});

		const satelliteSelect = page.getByLabelText('Satellite Feed');
		await expect.element(satelliteSelect).toBeEnabled();

		expect(baseLayerChanges).toEqual([{ value: 'streets' }]);
		expect(layerToggles).toEqual([
			{ layerId: 'weather-cmi', enabled: true },
			{ layerId: 'weather-precipitation', enabled: false }
		]);
		expect(controlChanges).toEqual([]);
	});
});
