<script lang="ts">
	type Props = {
		expanded?: boolean;
		onToggle?: () => void;
	};

	let { expanded = false, onToggle }: Props = $props();
</script>

<section class:musings--expanded={expanded} class="panel musings" aria-labelledby="musings-title">
	<button
		type="button"
		class="musings-card-toggle"
		aria-expanded={expanded}
		aria-controls="musings-body"
		onclick={() => onToggle?.()}
	>
		<div class="section-heading">
			<h2 id="musings-title">Musings</h2>
			<p>What do the people say.</p>
		</div>
		<span class="musings-toggle-label">{expanded ? 'Collapse' : 'Expand'}</span>
	</button>
	<div id="musings-body" class="musings-body">
		<div class="musings-empty" role="status">No titles published yet.</div>
	</div>
</section>

<style>
	.panel {
		background: var(--panel, rgba(7, 16, 29, 0.62));
		border: 1px solid var(--line, rgba(166, 198, 255, 0.22));
		border-radius: 1.1rem;
		padding: 1.2rem 1.1rem;
		backdrop-filter: blur(8px);
		box-shadow: 0 18px 34px rgba(1, 6, 16, 0.28);
	}

	.musings {
		min-height: 100%;
		min-width: 0;
		transition:
			padding 320ms cubic-bezier(0.16, 1, 0.3, 1),
			border-radius 320ms cubic-bezier(0.16, 1, 0.3, 1),
			box-shadow 320ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.musings--expanded {
		padding: 1.45rem 1.35rem;
		border-radius: 1.3rem;
		box-shadow: 0 24px 44px rgba(1, 6, 16, 0.34);
	}

	.musings-card-toggle {
		width: 100%;
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.9rem;
		text-align: left;
		cursor: pointer;
	}

	.musings-toggle-label {
		flex-shrink: 0;
		margin-top: 0.15rem;
		color: var(--link, #ffd8ac);
		font-size: 0.86rem;
		font-weight: 600;
	}

	.musings-card-toggle:hover .musings-toggle-label {
		color: #ffe8ca;
	}

	.musings-body {
		margin-top: 1rem;
		animation: reveal 280ms ease-out both;
	}

	.musings-empty {
		border: 1px dashed rgba(166, 198, 255, 0.26);
		border-radius: 0.8rem;
		padding: 0.95rem;
		color: var(--muted, rgba(203, 219, 247, 0.78));
		background: rgba(9, 20, 36, 0.3);
		font-size: 0.92rem;
	}

	.section-heading h2 {
		margin: 0;
		font-size: clamp(1.18rem, 2.5vw, 1.48rem);
		font-family: Georgia, 'Times New Roman', serif;
		color: var(--headline, #f5f8ff);
	}

	.section-heading p {
		margin: 0.35rem 0 0;
		color: var(--muted, rgba(203, 219, 247, 0.78));
		font-size: 0.94rem;
	}

	@keyframes reveal {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
