<script lang="ts">
	import type { CreateMusingInput, Musing } from '$lib/musings/types';

	type SortOption = 'newest' | 'oldest' | 'title';

	type Props = {
		expanded?: boolean;
		musings?: Musing[];
		loading?: boolean;
		canAddThought?: boolean;
		createPending?: boolean;
		errorMessage?: string | null;
		viewerLabel?: string | null;
		onCreateThought?: (musing: CreateMusingInput) => boolean | Promise<boolean>;
		onSignInRequest?: () => void;
		onToggle?: () => void;
	};

	let {
		expanded = false,
		musings = [],
		loading = false,
		canAddThought = false,
		createPending = false,
		errorMessage = null,
		viewerLabel = null,
		onCreateThought,
		onSignInRequest,
		onToggle
	}: Props = $props();

	let composerOpen = $state(false);
	let draftTitle = $state('');
	let draftBody = $state('');
	let filterQuery = $state('');
	let sortBy = $state<SortOption>('newest');

	const totalMusings = $derived(musings.length);
	const previewMusings = $derived.by(() =>
		[...musings]
			.sort(
				(left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
			)
			.slice(0, 2)
	);
	const filteredMusings = $derived.by(() => {
		const normalizedQuery = filterQuery.trim().toLowerCase();
		const visibleItems = normalizedQuery
			? musings.filter((musing) => {
					const haystack =
						`${musing.title ?? ''} ${musing.body} ${musing.authorLabel}`.toLowerCase();
					return haystack.includes(normalizedQuery);
				})
			: [...musings];

		visibleItems.sort((left, right) => {
			if (sortBy === 'title') {
				return (left.title ?? '').localeCompare(right.title ?? '');
			}

			const leftTime = new Date(left.createdAt).getTime();
			const rightTime = new Date(right.createdAt).getTime();
			return sortBy === 'oldest' ? leftTime - rightTime : rightTime - leftTime;
		});

		return visibleItems;
	});

	const canSubmit = $derived(draftBody.trim().length > 0 && !createPending);

	const formatDate = (value: string) =>
		new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(new Date(value));

	const resetComposer = () => {
		draftTitle = '';
		draftBody = '';
	};

	const openComposer = () => {
		if (!canAddThought) {
			onSignInRequest?.();
			return;
		}

		composerOpen = true;
	};

	const handleSubmit = async (event: SubmitEvent) => {
		event.preventDefault();
		if (!canAddThought || !draftBody.trim() || createPending) return;

		const created = await onCreateThought?.({
			title: draftTitle.trim() || null,
			body: draftBody.trim()
		});

		if (!created) return;
		resetComposer();
		composerOpen = false;
	};
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
			<p>What do the people say?</p>
		</div>
		<span class="musings-toggle-label">{expanded ? 'Collapse' : 'Expand'}</span>
	</button>
	<div id="musings-body" class="musings-body">
		{#if expanded}
			<div class="musings-controls">
				<div class="musings-controls-copy">
					<p class="musings-kicker">
						{loading
							? 'Loading the latest musings...'
							: `${totalMusings} thoughts drifting around Tooch Town`}
					</p>
					<p class="musings-helper">
						{loading
							? 'Give the town square a second.'
							: 'Browse everything, or sign in to add your own.'}
					</p>
				</div>
				<div class="musings-toolbar">
					<label class="musings-input-shell">
						<span class="sr-only">Filter musings</span>
						<input
							bind:value={filterQuery}
							type="search"
							name="musing-filter"
							placeholder="Filter musings"
						/>
					</label>
					<label class="musings-select-shell">
						<span class="sr-only">Sort musings</span>
						<select bind:value={sortBy} name="musing-sort">
							<option value="newest">Newest first</option>
							<option value="oldest">Oldest first</option>
							<option value="title">Title A-Z</option>
						</select>
					</label>
				</div>
			</div>

			{#if errorMessage}
				<div class="musings-status" role="status">
					<p>{errorMessage}</p>
				</div>
			{/if}

			<div class:musings-cta-row--signin={!canAddThought} class="musings-cta-row">
				{#if canAddThought}
					<button type="button" class="musings-add-button" onclick={openComposer}>
						<span class="musings-add-icon" aria-hidden="true">+</span>
						<span>{composerOpen ? 'Adding a thought below' : 'Add a thought'}</span>
					</button>
				{:else}
					<button type="button" class="musings-signin-button" onclick={() => onSignInRequest?.()}>
						Sign in to add one of your own
					</button>
				{/if}
			</div>

			{#if composerOpen && canAddThought}
				<form class="musings-composer" onsubmit={handleSubmit}>
					<label class="musings-field">
						<span>Title (optional)</span>
						<input
							bind:value={draftTitle}
							type="text"
							name="musing-title"
							maxlength="80"
							placeholder="A little headline for your thought"
							disabled={createPending}
						/>
					</label>
					<label class="musings-field">
						<span>Thought</span>
						<textarea
							bind:value={draftBody}
							name="musing-body"
							rows="4"
							maxlength="500"
							placeholder="Keep it short and strange."
							disabled={createPending}
						></textarea>
					</label>
					<div class="musings-composer-actions">
						<p class="musings-composer-note">Posting as {viewerLabel ?? 'you'}.</p>
						<div class="musings-button-row">
							<button
								type="button"
								class="musings-secondary-button"
								onclick={() => (composerOpen = false)}
								disabled={createPending}
							>
								Cancel
							</button>
							<button type="submit" class="musings-primary-button" disabled={!canSubmit}>
								{createPending ? 'Publishing...' : 'Publish thought'}
							</button>
						</div>
					</div>
				</form>
			{/if}

			{#if loading && filteredMusings.length === 0}
				<div class="musings-empty" role="status">
					<p class="musings-empty-title">Loading musings...</p>
					<p class="musings-empty-copy">The latest thoughts are on their way.</p>
				</div>
			{:else if filteredMusings.length > 0}
				<div class="musings-list" aria-live="polite">
					{#each filteredMusings as musing (musing.id)}
						<article class="musing-entry">
							<div class="musing-entry-meta">
								<p class="musing-entry-author">{musing.authorLabel}</p>
								<p class="musing-entry-date">{formatDate(musing.createdAt)}</p>
							</div>
							{#if musing.title}
								<h3>{musing.title}</h3>
							{/if}
							<p>{musing.body}</p>
						</article>
					{/each}
				</div>
			{:else}
				<div class="musings-empty" role="status">
					<p class="musings-empty-title">Nothing matches that filter yet.</p>
					<p class="musings-empty-copy">Try a different search or switch the sort order.</p>
				</div>
			{/if}
		{:else if previewMusings.length > 0}
			<div class="musings-preview-list">
				{#each previewMusings as musing (musing.id)}
					<article class="musing-preview-card">
						<div class="musing-entry-meta">
							<p class="musing-entry-author">{musing.authorLabel}</p>
							<p class="musing-entry-date">{formatDate(musing.createdAt)}</p>
						</div>
						{#if musing.title}
							<h3>{musing.title}</h3>
						{/if}
						<p>{musing.body}</p>
					</article>
				{/each}
			</div>
		{:else}
			<div class="musings-empty" role="status">
				<p class="musings-empty-title">No musings yet.</p>
				<p class="musings-empty-copy">Expand this panel to browse and add thoughts.</p>
			</div>
		{/if}
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

	.musings-controls {
		display: grid;
		gap: 0.9rem;
	}

	.musings-controls-copy {
		display: grid;
		gap: 0.2rem;
	}

	.musings-kicker,
	.musings-helper,
	.musings-empty-title,
	.musings-empty-copy,
	.musing-entry-meta p,
	.musing-entry p,
	.musing-preview-card p,
	.musings-composer-note,
	.musings-signin-prompt p {
		margin: 0;
	}

	.musings-kicker {
		color: var(--headline, #f5f8ff);
		font-size: 0.94rem;
		font-weight: 600;
	}

	.musings-helper {
		color: var(--muted, rgba(203, 219, 247, 0.78));
		font-size: 0.9rem;
	}

	.musings-toolbar {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.75rem;
	}

	.musings-input-shell input,
	.musings-select-shell select,
	.musings-field input,
	.musings-field textarea {
		width: 100%;
		border-radius: 0.85rem;
		border: 1px solid rgba(166, 198, 255, 0.2);
		background: rgba(8, 18, 32, 0.66);
		color: #f5f8ff;
		font: inherit;
		padding: 0.75rem 0.9rem;
		box-sizing: border-box;
	}

	.musings-select-shell select {
		min-width: 9rem;
	}

	.musings-input-shell input::placeholder,
	.musings-field input::placeholder,
	.musings-field textarea::placeholder {
		color: rgba(203, 219, 247, 0.52);
	}

	.musings-cta-row {
		margin-top: 1rem;
		display: flex;
		justify-content: flex-end;
	}

	.musings-cta-row--signin {
		margin-top: 1.35rem;
	}

	.musings-status {
		margin-top: 1rem;
		border: 1px solid rgba(255, 198, 127, 0.24);
		border-radius: 0.85rem;
		padding: 0.85rem 0.95rem;
		background: rgba(56, 23, 7, 0.28);
		color: #ffe0bb;
	}

	.musings-status p {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.45;
	}

	.musings-add-button,
	.musings-primary-button,
	.musings-secondary-button,
	.musings-signin-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.7rem;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
		transition:
			transform 140ms ease,
			border-color 140ms ease,
			background 140ms ease;
	}

	.musings-add-button,
	.musings-primary-button {
		border-radius: 999px;
	}

	.musings-add-button,
	.musings-primary-button {
		padding: 0.68rem 1rem 0.68rem 0.85rem;
		border: 1px solid rgba(255, 216, 172, 0.28);
		background:
			linear-gradient(180deg, rgba(255, 198, 127, 0.2), rgba(255, 198, 127, 0.08)),
			rgba(10, 24, 43, 0.78);
		color: var(--headline, #f5f8ff);
	}

	.musings-secondary-button {
		padding: 0.68rem 1rem;
		border: 1px solid rgba(166, 198, 255, 0.22);
		background: rgba(10, 24, 43, 0.62);
		color: #e8f1ff;
	}

	.musings-signin-button {
		padding: 0;
		border: none;
		background: transparent;
		color: var(--link, #ffd8ac);
		line-height: 1.4;
		text-decoration: underline;
		text-underline-offset: 0.16em;
	}

	.musings-signin-button:hover {
		color: #ffe8ca;
	}

	.musings-add-button:hover,
	.musings-primary-button:hover,
	.musings-secondary-button:hover,
	.musings-signin-button:hover {
		transform: translateY(-1px);
	}

	.musings-add-icon {
		width: 1.5rem;
		height: 1.5rem;
		display: inline-grid;
		place-items: center;
		border-radius: 999px;
		background: rgba(255, 216, 172, 0.18);
		color: var(--link, #ffd8ac);
		font-size: 1.1rem;
		line-height: 1;
	}

	.musings-composer {
		margin-top: 1rem;
		display: grid;
		gap: 0.9rem;
		padding: 1rem;
		border-radius: 1rem;
		border: 1px solid rgba(166, 198, 255, 0.18);
		background: rgba(5, 14, 27, 0.46);
	}

	.musings-field {
		display: grid;
		gap: 0.4rem;
	}

	.musings-field span {
		font-size: 0.88rem;
		font-weight: 600;
		color: var(--headline, #f5f8ff);
	}

	.musings-field textarea {
		resize: vertical;
		min-height: 7rem;
	}

	.musings-composer-actions,
	.musings-button-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.musings-composer-note {
		color: var(--muted, rgba(203, 219, 247, 0.78));
		font-size: 0.88rem;
	}

	.musings-primary-button:disabled {
		cursor: not-allowed;
		opacity: 0.5;
		transform: none;
	}

	.musings-secondary-button:disabled,
	.musings-field input:disabled,
	.musings-field textarea:disabled {
		cursor: not-allowed;
		opacity: 0.5;
		transform: none;
	}

	.musings-list,
	.musings-preview-list {
		margin-top: 1rem;
		display: grid;
		gap: 0.85rem;
	}

	.musing-entry,
	.musing-preview-card {
		display: grid;
		gap: 0.45rem;
		padding: 1rem;
		border-radius: 1rem;
		border: 1px solid rgba(166, 198, 255, 0.16);
		background:
			linear-gradient(180deg, rgba(12, 28, 48, 0.72), rgba(9, 18, 32, 0.88)), rgba(7, 16, 29, 0.5);
	}

	.musing-entry-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		font-size: 0.8rem;
		color: var(--muted, rgba(203, 219, 247, 0.78));
	}

	.musing-entry-author {
		color: var(--link, #ffd8ac);
		font-weight: 600;
	}

	.musing-entry h3,
	.musing-preview-card h3 {
		margin: 0;
		font-size: 1rem;
		color: var(--headline, #f5f8ff);
	}

	.musing-entry p:last-child,
	.musing-preview-card p:last-child {
		color: var(--body, rgba(227, 238, 255, 0.9));
		line-height: 1.55;
		font-size: 0.93rem;
	}

	.musings-empty {
		margin-top: 1rem;
		border: 1px dashed rgba(166, 198, 255, 0.26);
		border-radius: 0.8rem;
		padding: 1rem;
		color: var(--muted, rgba(203, 219, 247, 0.78));
		background: rgba(9, 20, 36, 0.3);
		display: grid;
		gap: 0.3rem;
	}

	.musings-empty-title {
		color: var(--headline, #f5f8ff);
		font-weight: 600;
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

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
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

	@media (max-width: 40rem) {
		.musings-toolbar {
			grid-template-columns: 1fr;
		}

		.musings-signin-prompt,
		.musing-entry-meta {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
