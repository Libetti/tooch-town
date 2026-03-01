<script lang="ts">
	const projects = [
		{
			name: 'My Flightfeeder',
			description: 'Live view of my hosted fightfeeder',
			href: '/feeder',
			label: 'View Feeder Map'
		},
		{
			name: 'Farm Health',
			description: 'Check the health of my humble farm',
			href: '/feeder',
			label: 'View Feeder Map'
		},
		{
			name: 'Upcoming AI project....',
			description: 'Wee Wooo Coming Soon!',
			href: '#',
			label: 'DO NOT TOUCH'
		}
	];

	const profileLinks = [
		{ name: 'GitHub', href: 'https://github.com/libetti' },
		{ name: 'LinkedIn', href: 'https://www.linkedin.com/in/libetti' },
		{ name: 'Email', href: 'mailto:anthony.libetti@yahoo.com' }
	];
</script>

<svelte:head>
	<title>Anthony Libetti | Tooch Town</title>
	<meta
		name="description"
		content="Personal landing page for Anthony Libetti and the projects being built in Tooch Town."
	/>
</svelte:head>

<iframe
	src="/windwaker-great-sea.html"
	class="sea-frame"
	title="Animated Great Sea Background"
	loading="eager"
	aria-hidden="true"
></iframe>

<main class="landing">
	<section class="hero">
		<p class="eyebrow">Tooch Town</p>
		<h1>Anthony Libetti</h1>
		<p class="intro">
			So you made it, welcome to my hood bitches. Home to me, a map-fancy software engineer whose
			life mission is to continue to afford a series of stupid hobbies which end up abandoned.
		</p>
		<div class="links" aria-label="profile links">
			{#each profileLinks as link}
				<a href={link.href} target="_blank" rel="noreferrer">{link.name}</a>
			{/each}
		</div>
	</section>

	<section class="projects" aria-labelledby="projects-title">
		<div class="projects-heading">
			<h2 id="projects-title">Current Projects</h2>
			<p>A quick snapshot of the projects this site will host.</p>
		</div>
		<ul class="project-grid">
			{#each projects as project}
				<li class="project-card">
					<h3>{project.name}</h3>
					<p>{project.description}</p>
					<a href={project.href}>
						{project.label}
					</a>
				</li>
			{/each}
		</ul>
	</section>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #5aa4e6;
		color: #1f2530;
		font-family: 'Avenir Next', Avenir, 'Segoe UI', sans-serif;
	}

	.sea-frame {
		position: fixed;
		inset: 0;
		z-index: 0;
		width: 100vw;
		height: 100vh;
		display: block;
		border: 0;
		pointer-events: none;
	}

	.landing {
		--panel: rgba(255, 255, 255, 0.82);
		--line: rgba(18, 54, 78, 0.2);
		--headline: #11161f;
		--accent: #c0571a;
		position: relative;
		z-index: 1;
		isolation: isolate;
		max-width: 68rem;
		margin: 0 auto;
		padding: 4rem 1.25rem 5rem;
	}

	.hero {
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 1.25rem;
		padding: 2rem;
		backdrop-filter: blur(5px);
		box-shadow: 0 14px 40px rgba(23, 28, 37, 0.08);
		animation: reveal 550ms ease-out both;
	}

	.eyebrow {
		margin: 0 0 0.75rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		font-weight: 700;
		font-size: 0.72rem;
		color: var(--accent);
	}

	h1 {
		margin: 0 0 1rem;
		font-size: clamp(2rem, 5vw, 3.25rem);
		line-height: 1.08;
		font-family: Georgia, 'Times New Roman', serif;
		color: var(--headline);
	}

	.intro {
		margin: 0;
		max-width: 60ch;
		line-height: 1.65;
		font-size: 1.04rem;
	}

	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 1.5rem;
	}

	.links a {
		text-decoration: none;
		color: #172231;
		border: 1px solid var(--line);
		border-radius: 999px;
		padding: 0.45rem 0.9rem;
		font-size: 0.92rem;
		background: rgba(255, 255, 255, 0.7);
		transition:
			transform 140ms ease,
			background 140ms ease;
	}

	.links a:hover {
		transform: translateY(-1px);
		background: #fff;
	}

	.projects {
		margin-top: 2.25rem;
	}

	.projects-heading h2 {
		margin: 0;
		font-size: clamp(1.35rem, 3vw, 1.8rem);
		font-family: Georgia, 'Times New Roman', serif;
	}

	.projects-heading p {
		margin: 0.35rem 0 0;
		color: rgba(31, 37, 48, 0.82);
	}

	.project-grid {
		list-style: none;
		margin: 1.1rem 0 0;
		padding: 0;
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
	}

	.project-card {
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 1rem;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		animation: reveal 550ms ease-out both;
	}

	.project-card:nth-child(2) {
		animation-delay: 90ms;
	}

	.project-card:nth-child(3) {
		animation-delay: 180ms;
	}

	.project-card h3 {
		margin: 0;
		font-size: 1.1rem;
	}

	.project-card p {
		margin: 0;
		line-height: 1.52;
		color: rgba(31, 37, 48, 0.88);
	}

	.project-card a {
		width: fit-content;
		font-size: 0.9rem;
		text-decoration: none;
		color: #9b3f06;
		font-weight: 600;
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
		.landing {
			padding-top: 2.25rem;
		}

		.hero {
			padding: 1.4rem;
		}
	}
</style>
