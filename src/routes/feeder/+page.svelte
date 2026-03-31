<svelte:head>
	<title>Feeder | Tooch Town</title>
</svelte:head>

<div class="feeder-shell">
	<div class="feeder-card">
		<p class="eyebrow">FlightAware FlightFeeder</p>
		<h1>Uh Oh</h1>
		<p>Now where'd my damn feeder run off to?</p>
		<p>Did I ever even have a feeder?</p>
		<a href="/">Back home</a>
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		background: #0b1627;
		color: #e8f1ff;
		font-family: 'Avenir Next', Avenir, 'Segoe UI', sans-serif;
	}

	.feeder-shell {
		--panel: rgba(7, 16, 29, 0.62);
		--line: rgba(166, 198, 255, 0.22);
		--headline: #f5f8ff;
		--body: rgba(227, 238, 255, 0.9);
		--accent: #ffc67f;
		min-height: 100vh;
		padding: 2rem;
		display: grid;
		place-items: center;
		background:
			radial-gradient(circle at top, rgba(65, 105, 166, 0.18), transparent 35%),
			linear-gradient(180deg, rgba(6, 11, 20, 0.25), rgba(6, 11, 20, 0.6));
	}

	.feeder-card {
		display: grid;
		gap: 0.75rem;
		width: min(100%, 38rem);
		padding: 2rem 1.75rem;
		text-align: center;
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 1.25rem;
		backdrop-filter: blur(8px);
		box-shadow: 0 18px 36px rgba(1, 6, 16, 0.32);
	}

	.eyebrow {
		margin: 0;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		font-weight: 700;
		font-size: 0.72rem;
		color: var(--accent);
	}

	h1 {
		margin: 0;
		font-size: clamp(2rem, 5vw, 3rem);
		line-height: 1.08;
		font-family: Georgia, 'Times New Roman', serif;
		color: var(--headline);
	}

	p {
		margin: 0;
		line-height: 1.6;
		color: var(--body);
	}

	a {
		width: fit-content;
		justify-self: center;
		margin-top: 0.35rem;
		text-decoration: none;
		color: #e8f1ff;
		border: 1px solid var(--line);
		border-radius: 999px;
		padding: 0.45rem 0.9rem;
		font-size: 0.92rem;
		background: rgba(13, 27, 47, 0.42);
		transition:
			transform 140ms ease,
			background 140ms ease;
	}

	a:hover {
		transform: translateY(-1px);
		background: rgba(13, 27, 47, 0.62);
	}
</style>
