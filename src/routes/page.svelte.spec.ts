import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

describe('/+page.svelte', () => {
	it('should render the landing page content', async () => {
		render(Page);

		const heading = page.getByRole('heading', { level: 1, name: 'Anthony Libetti' });
		const projectsHeading = page.getByRole('heading', { level: 2, name: 'Current Projects' });

		await expect.element(heading).toBeInTheDocument();
		await expect.element(projectsHeading).toBeInTheDocument();
	});
});
