<script lang="ts">
	import { onMount } from 'svelte';

	let seaCanvas: HTMLCanvasElement | null = null;

	type DriftStroke = {
		seed: number;
		lane: number;
		y: number;
		length: number;
		speed: number;
		alpha: number;
		arc: number;
	};

	const projects = [
		{
			name: 'Tooch Town',
			description: 'A home base for experiments, builds, and polished side projects.',
			href: '#',
			label: 'Case study in progress'
		},
		{
			name: 'Project Atlas',
			description: 'A private tool for organizing ideas into action-ready plans.',
			href: '#',
			label: 'Prototype'
		},
		{
			name: 'Neighborhood Notes',
			description: 'A simple way to collect local recommendations and share them fast.',
			href: '#',
			label: 'Launching soon'
		}
	];

	const profileLinks = [
		{ name: 'GitHub', href: 'https://github.com' },
		{ name: 'LinkedIn', href: 'https://linkedin.com' },
		{ name: 'Email', href: 'mailto:hello@example.com' }
	];

	const TAU = Math.PI * 2;

	const randomFromSeed = (seed: number): number => {
		const value = Math.sin(seed * 12.9898) * 43758.5453123;
		return value - Math.floor(value);
	};

	const wrap = (value: number, max: number): number => {
		return ((value % max) + max) % max;
	};

	onMount(() => {
		const canvas = seaCanvas;
		if (!canvas) {
			return;
		}

		const ctx = canvas.getContext('2d');
		if (!ctx) {
			return;
		}

		let frameId = 0;
		let width = 0;
		let height = 0;
		let dpr = 1;

		const skyWind: DriftStroke[] = Array.from({ length: 8 }, (_, index) => {
			const seed = index + 11;
			return {
				seed,
				lane: (index + 0.2 + randomFromSeed(seed * 1.5) * 0.16) / 8,
				y: 0.14 + (index % 4) * 0.075 + randomFromSeed(seed * 1.8) * 0.018,
				length: 120 + randomFromSeed(seed * 2.4) * 180,
				speed: 7.8,
				alpha: 0.2 + randomFromSeed(seed * 3.1) * 0.2,
				arc: -2.6 + randomFromSeed(seed * 4.4) * 5.2
			};
		});

		const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

		const resize = (): void => {
			width = window.innerWidth;
			height = window.innerHeight;
			dpr = Math.min(window.devicePixelRatio || 1, 2);
			canvas.width = Math.floor(width * dpr);
			canvas.height = Math.floor(height * dpr);
			canvas.style.width = `${width}px`;
			canvas.style.height = `${height}px`;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};

		const drawStreak = (
			x: number,
			y: number,
			length: number,
			arc: number,
			alpha: number,
			thickness: number
		): void => {
			ctx.strokeStyle = `rgba(231, 249, 255, ${alpha})`;
			ctx.lineWidth = thickness;
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.quadraticCurveTo(x + length * 0.5, y + arc, x + length, y - arc * 0.2);
			ctx.stroke();
		};

		const drawMainCloud = (time: number): void => {
			const x = width * 0.5 + Math.sin(time * 0.08) * 10;
			const y = height * 0.19 + Math.sin(time * 0.16) * 1.8;
			const base = Math.min(width, height) * 0.1;

			const shadow = ctx.createRadialGradient(x, y + base * 0.35, base * 0.3, x, y + base * 0.35, base * 1.25);
			shadow.addColorStop(0, 'rgba(198, 214, 211, 0.34)');
			shadow.addColorStop(1, 'rgba(198, 214, 211, 0)');
			ctx.fillStyle = shadow;
			ctx.beginPath();
			ctx.ellipse(x, y + base * 0.35, base * 1.16, base * 0.54, 0, 0, TAU);
			ctx.fill();

			ctx.fillStyle = 'rgba(241, 243, 230, 0.92)';
			ctx.beginPath();
			ctx.ellipse(x - base * 0.55, y + base * 0.1, base * 0.4, base * 0.34, 0, 0, TAU);
			ctx.ellipse(x - base * 0.2, y - base * 0.1, base * 0.47, base * 0.4, 0, 0, TAU);
			ctx.ellipse(x + base * 0.2, y + base * 0.02, base * 0.52, base * 0.36, 0, 0, TAU);
			ctx.ellipse(x + base * 0.6, y + base * 0.12, base * 0.36, base * 0.3, 0, 0, TAU);
			ctx.fill();

			ctx.fillStyle = 'rgba(225, 235, 226, 0.55)';
			ctx.beginPath();
			ctx.ellipse(x - base * 0.25, y + base * 0.22, base * 0.92, base * 0.32, 0, 0, TAU);
			ctx.fill();
		};

		const drawScene = (timeMs: number): void => {
			const time = timeMs * 0.001;
			const horizon = height * 0.61 + Math.sin(time * 0.2) * 0.8;

			ctx.clearRect(0, 0, width, height);

			const skyGradient = ctx.createLinearGradient(0, 0, 0, horizon);
			skyGradient.addColorStop(0, '#51d4f0');
			skyGradient.addColorStop(0.56, '#8beaf8');
			skyGradient.addColorStop(1, '#d9fbff');
			ctx.fillStyle = skyGradient;
			ctx.fillRect(0, 0, width, horizon);

			const sunX = width * 0.52;
			const sunY = height * 0.05;
			const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, height * 0.4);
			sunGlow.addColorStop(0, 'rgba(255, 249, 219, 0.2)');
			sunGlow.addColorStop(1, 'rgba(255, 249, 219, 0)');
			ctx.fillStyle = sunGlow;
			ctx.fillRect(0, 0, width, horizon);

			for (const streak of skyWind) {
				const y = horizon * streak.y;
				if (y >= horizon - 8) {
					continue;
				}
				const span = width + streak.length * 1.5;
				const x = wrap(streak.lane * span - time * streak.speed * 16, span) - streak.length;
				drawStreak(x, y, streak.length, streak.arc, streak.alpha, 1.8);
				drawStreak(
					x + streak.length * 0.08,
					y + 1.2,
					streak.length * 0.78,
					streak.arc * 0.65,
					streak.alpha * 0.5,
					1.1
				);
			}

			drawMainCloud(time);

			ctx.fillStyle = 'rgba(227, 244, 248, 0.45)';
			ctx.beginPath();
			ctx.ellipse(width * 0.32, horizon - height * 0.06, width * 0.18, height * 0.03, 0, 0, TAU);
			ctx.ellipse(width * 0.58, horizon - height * 0.055, width * 0.2, height * 0.028, 0, 0, TAU);
			ctx.ellipse(width * 0.82, horizon - height * 0.06, width * 0.16, height * 0.025, 0, 0, TAU);
			ctx.fill();

			const horizonGlow = ctx.createLinearGradient(0, horizon - 22, 0, horizon + 26);
			horizonGlow.addColorStop(0, 'rgba(223, 248, 255, 0)');
			horizonGlow.addColorStop(0.46, 'rgba(214, 243, 255, 0.78)');
			horizonGlow.addColorStop(1, 'rgba(214, 243, 255, 0)');
			ctx.fillStyle = horizonGlow;
			ctx.fillRect(0, horizon - 24, width, 52);

			const oceanGradient = ctx.createLinearGradient(0, horizon, 0, height);
			oceanGradient.addColorStop(0, '#238ff5');
			oceanGradient.addColorStop(0.45, '#1f86ee');
			oceanGradient.addColorStop(1, '#1c7de7');
			ctx.fillStyle = oceanGradient;
			ctx.fillRect(0, horizon, width, height - horizon);
		};

		const frame = (timeMs: number): void => {
			drawScene(timeMs);
			frameId = window.requestAnimationFrame(frame);
		};

		const onResize = (): void => {
			resize();
			if (prefersReducedMotion.matches) {
				drawScene(0);
			}
		};

		const onMotionChange = (): void => {
			window.cancelAnimationFrame(frameId);
			if (prefersReducedMotion.matches) {
				drawScene(0);
				return;
			}
			frameId = window.requestAnimationFrame(frame);
		};

		window.addEventListener('resize', onResize);

		if ('addEventListener' in prefersReducedMotion) {
			prefersReducedMotion.addEventListener('change', onMotionChange);
		}

		resize();
		if (prefersReducedMotion.matches) {
			drawScene(0);
		} else {
			frameId = window.requestAnimationFrame(frame);
		}

		return () => {
			window.cancelAnimationFrame(frameId);
			window.removeEventListener('resize', onResize);
			if ('removeEventListener' in prefersReducedMotion) {
				prefersReducedMotion.removeEventListener('change', onMotionChange);
			}
		};
	});
</script>

<svelte:head>
	<title>Anthony Libetti | Tooch Town</title>
	<meta
		name="description"
		content="Personal landing page for Anthony Libetti and the projects being built in Tooch Town."
	/>
</svelte:head>

<canvas bind:this={seaCanvas} class="sea-canvas" aria-hidden="true"></canvas>

<main class="landing">
	<section class="hero">
		<p class="eyebrow">Tooch Town</p>
		<h1>Anthony Libetti</h1>
		<p class="intro">
			Software engineer building small, useful products with strong UX and clear technical foundations.
			This site is the central hub for what I am shipping now and what is next.
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

	.sea-canvas {
		position: fixed;
		inset: 0;
		z-index: 0;
		width: 100vw;
		height: 100vh;
		display: block;
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
