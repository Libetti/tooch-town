import { describe, expect, it } from 'vitest';
import {
	DEFAULT_RAIN_LAYER_CONFIG,
	boostPrecipitationIntensity,
	createRainAnimationState,
	generateRainParticles,
	updateRainAnimationState,
	type PrecipCell
} from './precipitation';

describe('boostPrecipitationIntensity', () => {
	it('maps dry conditions to zero', () => {
		expect(boostPrecipitationIntensity(0)).toBe(0);
	});

	it('dramatically boosts light precipitation', () => {
		expect(boostPrecipitationIntensity(0.15)).toBeGreaterThan(0.2);
	});

	it('raises moderate precipitation above light values', () => {
		const light = boostPrecipitationIntensity(0.2);
		const moderate = boostPrecipitationIntensity(1.6);
		expect(moderate).toBeGreaterThan(light);
	});

	it('clamps heavy precipitation at or below one', () => {
		expect(boostPrecipitationIntensity(30)).toBeLessThanOrEqual(1);
	});
});

describe('generateRainParticles', () => {
	it('honors per-cell and global caps', () => {
		const cells: PrecipCell[] = [
			{ lon: 0, lat: 0, precipitationMmPerHour: 3, visualIntensity: 1 },
			{ lon: 4, lat: 0, precipitationMmPerHour: 3, visualIntensity: 1 },
			{ lon: 8, lat: 0, precipitationMmPerHour: 3, visualIntensity: 1 }
		];

		const particles = generateRainParticles(
			cells,
			{
				...DEFAULT_RAIN_LAYER_CONFIG,
				perCellParticleCap: 8,
				globalParticleCap: 10
			},
			10
		);

		expect(particles.length).toBe(10);
	});

	it('filters out cells under active minimum precipitation threshold', () => {
		const cells: PrecipCell[] = [
			{ lon: 0, lat: 0, precipitationMmPerHour: 0.1, visualIntensity: 0.8 },
			{ lon: 4, lat: 0, precipitationMmPerHour: 0.3, visualIntensity: 0.9 }
		];

		const particles = generateRainParticles(cells, DEFAULT_RAIN_LAYER_CONFIG, 2, {
			minPrecipMmPerHour: 0.2,
			perCellParticleCap: 12
		});

		expect(particles.length).toBeGreaterThan(0);
		expect(
			particles.every(
				(particle) => particle.sourcePosition[0] >= 2 || particle.sourcePosition[0] <= 6
			)
		).toBe(true);
	});
});

describe('updateRainAnimationState', () => {
	it('degrades per-cell cap first on low frame rates, then raises threshold', () => {
		let state = createRainAnimationState(DEFAULT_RAIN_LAYER_CONFIG);
		for (let i = 0; i < 16; i += 1) {
			state = updateRainAnimationState(state, 60);
		}

		expect(state.activePerCellCap).toBe(8);
		expect(state.activeMinPrecipMmPerHour).toBeGreaterThanOrEqual(0.2);
	});
});
