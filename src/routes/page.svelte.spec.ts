import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

const renderPage = () => {
	render(Page, {
		data: {
			initialCenter: [-75.5663, 39.662]
		}
	});
};

describe('/+page.svelte', () => {
	it('should render the landing page content', async () => {
		renderPage();

		const heading = page.getByRole('heading', { level: 1, name: 'Anthony Libetti' });
		const projectsHeading = page.getByRole('heading', { level: 2, name: 'Current Projects' });

		await expect.element(heading).toBeInTheDocument();
		await expect.element(projectsHeading).toBeInTheDocument();
	});

	it('opens and closes the layer sidebar from the collapsed card bar', async () => {
		renderPage();

		await page.getByRole('button', { name: 'Hide cards' }).click();
		await expect.element(page.getByRole('button', { name: 'Open Menu' })).toBeInTheDocument();

		await page.getByRole('button', { name: 'Layers' }).click();
		await expect.element(page.getByRole('dialog', { name: 'Layers' })).toBeInTheDocument();

		await page.getByRole('button', { name: 'Close Layers' }).click();
		await expect.element(page.getByRole('dialog', { name: 'Layers' })).not.toBeInTheDocument();

		await page.getByRole('button', { name: 'Layers' }).click();
		await expect.element(page.getByRole('dialog', { name: 'Layers' })).toBeInTheDocument();
		await page.getByRole('button', { name: 'Close layers panel' }).click();
		await expect.element(page.getByRole('dialog', { name: 'Layers' })).not.toBeInTheDocument();

		await page.getByRole('button', { name: 'Layers' }).click();
		await expect.element(page.getByRole('dialog', { name: 'Layers' })).toBeInTheDocument();
		await page.keyboard.press('Escape');
		await expect.element(page.getByRole('dialog', { name: 'Layers' })).not.toBeInTheDocument();
	});

	it('updates base map and weather controls from the layer sidebar', async () => {
		renderPage();

		await page.getByRole('button', { name: 'Hide cards' }).click();
		await page.getByRole('button', { name: 'Layers' }).click();

		const streetsRadio = page.getByRole('radio', { name: 'Streets' });
		await streetsRadio.click();
		await expect.element(streetsRadio).toBeChecked();

		const weatherToggle = page.getByRole('checkbox', { name: 'Weather' });
		await page.getByRole('button', { name: 'Options' }).nth(1).click();
		const satelliteSelect = page.getByLabelText('Satellite Feed');
		await expect.element(satelliteSelect).toBeDisabled();

		await weatherToggle.click();
		await expect.element(weatherToggle).toBeChecked();
		await expect.element(satelliteSelect).toBeEnabled();

		await satelliteSelect.selectOption('goes-west');
		await expect.element(satelliteSelect).toHaveValue('goes-west');
	});
});
