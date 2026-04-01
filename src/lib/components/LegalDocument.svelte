<script lang="ts">
	import type { LegalDocument } from '$lib/legal/markdown';
	import { renderInlineMarkdown } from '$lib/legal/markdown';

	let { document }: { document: LegalDocument } = $props();
</script>

<svelte:head>
	<title>{document.title}</title>
	<meta name="description" content={document.title} />
</svelte:head>

<div class="legal-shell">
	<article class="legal-card">
		<header class="legal-header">
			<p class="legal-eyebrow">ToochTown Legal</p>
			<h1>{document.title}</h1>
			{#if document.effectiveDate}
				<p class="legal-effective">Effective Date: {document.effectiveDate}</p>
			{/if}
		</header>

		{#if document.intro.length > 0}
			<section class="legal-section">
				{#each document.intro as block}
					{#if block.type === 'paragraph'}
						<p>{@html renderInlineMarkdown(block.text)}</p>
					{:else if block.type === 'list'}
						<ul>
							{#each block.items as item}
								<li>{@html renderInlineMarkdown(item)}</li>
							{/each}
						</ul>
					{/if}
				{/each}
			</section>
		{/if}

		{#each document.sections as section}
			<section class="legal-section">
				<h2>{section.heading}</h2>
				{#each section.blocks as block}
					{#if block.type === 'paragraph'}
						<p>{@html renderInlineMarkdown(block.text)}</p>
					{:else if block.type === 'list'}
						<ul>
							{#each block.items as item}
								<li>{@html renderInlineMarkdown(item)}</li>
							{/each}
						</ul>
					{/if}
				{/each}
			</section>
		{/each}
	</article>
</div>

<style>
	:global(body) {
		margin: 0;
		background:
			radial-gradient(circle at top, rgb(46 125 50 / 0.18), transparent 28rem),
			linear-gradient(180deg, #08120b 0%, #0f1d13 100%);
		color: #e8f3ea;
		font-family:
			'Georgia', 'Iowan Old Style', 'Palatino Linotype', 'URW Palladio L', serif;
	}

	.legal-shell {
		min-height: 100vh;
		padding: 3rem 1.25rem;
	}

	.legal-card {
		max-width: 52rem;
		margin: 0 auto;
		padding: 2rem;
		border: 1px solid rgb(186 230 193 / 0.2);
		border-radius: 1.5rem;
		background: rgb(8 18 11 / 0.78);
		box-shadow: 0 1.5rem 4rem rgb(0 0 0 / 0.25);
		backdrop-filter: blur(10px);
	}

	.legal-header {
		margin-bottom: 2rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid rgb(186 230 193 / 0.15);
	}

	.legal-eyebrow,
	.legal-effective {
		margin: 0;
		color: #b8d9bd;
		font-size: 0.95rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0.5rem 0 0.75rem;
		font-size: clamp(2.2rem, 5vw, 3.8rem);
		line-height: 1.05;
	}

	h2 {
		margin: 0 0 0.9rem;
		font-size: clamp(1.3rem, 3vw, 1.8rem);
		line-height: 1.2;
	}

	p,
	li {
		color: #edf7ef;
		font-size: 1.05rem;
		line-height: 1.75;
	}

	p {
		margin: 0;
	}

	.legal-section + .legal-section {
		margin-top: 1.75rem;
	}

	.legal-section :global(p + p),
	.legal-section :global(p + ul),
	.legal-section :global(ul + p),
	.legal-section :global(ul + ul) {
		margin-top: 0.9rem;
	}

	ul {
		margin: 0;
		padding-left: 1.5rem;
	}

	li + li {
		margin-top: 0.45rem;
	}

	:global(a) {
		color: #9ce7ab;
	}

	@media (max-width: 640px) {
		.legal-shell {
			padding: 1.25rem 0.9rem;
		}

		.legal-card {
			padding: 1.35rem;
			border-radius: 1.1rem;
		}
	}
</style>
