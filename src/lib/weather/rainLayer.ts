import { ScenegraphLayer } from '@deck.gl/mesh-layers';
import {
	DEFAULT_RAIN_LAYER_CONFIG,
	type PrecipCell,
	type RainAnimationState,
	type RainLayerConfig
} from '$lib/weather/precipitation';

type RainSceneInstance = {
	position: [number, number, number];
	color: [number, number, number, number];
	scale: [number, number, number];
	orientation: [number, number, number];
};

const clamp = (value: number, min: number, max: number): number =>
	Math.max(min, Math.min(max, value));

const seededHash = (value: string): number => {
	let hash = 1779033703 ^ value.length;
	for (let i = 0; i < value.length; i += 1) {
		hash = Math.imul(hash ^ value.charCodeAt(i), 3432918353);
		hash = (hash << 13) | (hash >>> 19);
	}
	return hash >>> 0;
};

const mulberry32 = (seed: number): (() => number) => {
	let t = seed >>> 0;
	return () => {
		t += 0x6d2b79f5;
		let n = Math.imul(t ^ (t >>> 15), t | 1);
		n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
		return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
	};
};

const MAX_SCENEGRAPH_INSTANCES = 50_000;
const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const keyFor = (ix: number, iy: number): string => `${ix}:${iy}`;

const sampleFlowField = (lon: number, lat: number): [number, number] => {
	// Low-frequency flow field to visually connect rain across cell boundaries.
	const a = Math.sin(toRadians(lon * 0.16 + lat * 0.11));
	const b = Math.cos(toRadians(lon * 0.09 - lat * 0.14));
	return [a * 0.07 + b * 0.04, b * 0.06 - a * 0.03];
};

type RainCellNode = {
	cell: PrecipCell;
	ix: number;
	iy: number;
	intensity: number;
};

type RainCluster = {
	nodes: RainCellNode[];
	minLon: number;
	maxLon: number;
	minLat: number;
	maxLat: number;
	avgIntensity: number;
	intensityByKey: Map<string, number>;
};

const smoothRainCells = (cells: PrecipCell[], gridStepDegrees: number): PrecipCell[] => {
	if (!cells.length) return [];

	const baseField = new Map<string, PrecipCell>();
	for (const cell of cells) {
		const ix = Math.round((cell.lon + 180) / gridStepDegrees);
		const iy = Math.round((cell.lat + 90) / gridStepDegrees);
		baseField.set(keyFor(ix, iy), cell);
	}

	// Kernel blur in grid space to bridge visible seams between adjacent rain cells.
	const offsets: Array<{ dx: number; dy: number; weight: number }> = [];
	for (let dx = -2; dx <= 2; dx += 1) {
		for (let dy = -2; dy <= 2; dy += 1) {
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist > 2.2) continue;
			const weight = Math.exp(-(dist * dist) / 2.1);
			offsets.push({ dx, dy, weight });
		}
	}

	const accum = new Map<string, { lon: number; lat: number; weighted: number; weight: number }>();

	for (const cell of cells) {
		const ix = Math.round((cell.lon + 180) / gridStepDegrees);
		const iy = Math.round((cell.lat + 90) / gridStepDegrees);
		const baseIntensity = clamp(cell.visualIntensity, 0, 1);

		for (const offset of offsets) {
			const nx = ix + offset.dx;
			const ny = iy + offset.dy;
			const key = keyFor(nx, ny);
			const existing = accum.get(key);
			const lon = nx * gridStepDegrees - 180;
			const lat = ny * gridStepDegrees - 90;
			const weighted = baseIntensity * offset.weight;

			if (!existing) {
				accum.set(key, {
					lon,
					lat,
					weighted,
					weight: offset.weight
				});
				continue;
			}

			existing.weighted += weighted;
			existing.weight += offset.weight;
		}
	}

	const smoothed: PrecipCell[] = [];
	for (const [key, value] of accum.entries()) {
		const blurredIntensity = value.weight > 0 ? value.weighted / value.weight : 0;
		const baseCell = baseField.get(key);
		const intensity = baseCell
			? Math.max(blurredIntensity, clamp(baseCell.visualIntensity, 0, 1))
			: blurredIntensity * 0.92;
		if (intensity < 0.045) continue;

		smoothed.push({
			lon: value.lon,
			lat: value.lat,
			precipitationMmPerHour: Math.max(0.05, intensity * 2.4),
			visualIntensity: clamp(intensity, 0, 1)
		});
	}

	return smoothed;
};

const buildRainClusters = (cells: PrecipCell[], gridStepDegrees: number): RainCluster[] => {
	const nodes: RainCellNode[] = cells.map((cell) => {
		const ix = Math.round((cell.lon + 180) / gridStepDegrees);
		const iy = Math.round((cell.lat + 90) / gridStepDegrees);
		return {
			cell,
			ix,
			iy,
			intensity: clamp(cell.visualIntensity, 0, 1)
		};
	});

	const nodeByKey = new Map<string, RainCellNode>();
	for (const node of nodes) nodeByKey.set(keyFor(node.ix, node.iy), node);

	const visited = new Set<string>();
	const clusters: RainCluster[] = [];
	const neighborOffsets: Array<[number, number]> = [
		[-1, -1],
		[-1, 0],
		[-1, 1],
		[0, -1],
		[0, 1],
		[1, -1],
		[1, 0],
		[1, 1]
	];

	for (const seedNode of nodes) {
		const seedKey = keyFor(seedNode.ix, seedNode.iy);
		if (visited.has(seedKey)) continue;

		const queue: RainCellNode[] = [seedNode];
		visited.add(seedKey);

		const clusterNodes: RainCellNode[] = [];
		let minLon = seedNode.cell.lon;
		let maxLon = seedNode.cell.lon;
		let minLat = seedNode.cell.lat;
		let maxLat = seedNode.cell.lat;
		let intensitySum = 0;
		const intensityByKey = new Map<string, number>();

		while (queue.length) {
			const node = queue.pop() as RainCellNode;
			clusterNodes.push(node);
			intensitySum += node.intensity;
			intensityByKey.set(keyFor(node.ix, node.iy), node.intensity);
			minLon = Math.min(minLon, node.cell.lon);
			maxLon = Math.max(maxLon, node.cell.lon);
			minLat = Math.min(minLat, node.cell.lat);
			maxLat = Math.max(maxLat, node.cell.lat);

			for (const [dx, dy] of neighborOffsets) {
				const nx = node.ix + dx;
				const ny = node.iy + dy;
				const neighborKey = keyFor(nx, ny);
				if (visited.has(neighborKey)) continue;
				const neighbor = nodeByKey.get(neighborKey);
				if (!neighbor) continue;
				visited.add(neighborKey);
				queue.push(neighbor);
			}
		}

		clusters.push({
			nodes: clusterNodes,
			minLon,
			maxLon,
			minLat,
			maxLat,
			avgIntensity: intensitySum / Math.max(1, clusterNodes.length),
			intensityByKey
		});
	}

	return clusters;
};

const sampleClusterIntensity = (
	cluster: RainCluster,
	lon: number,
	lat: number,
	gridStepDegrees: number
): number => {
	const gx = (lon + 180) / gridStepDegrees;
	const gy = (lat + 90) / gridStepDegrees;
	const ix = Math.floor(gx);
	const iy = Math.floor(gy);
	const tx = gx - ix;
	const ty = gy - iy;

	const i00 = cluster.intensityByKey.get(keyFor(ix, iy)) ?? 0;
	const i10 = cluster.intensityByKey.get(keyFor(ix + 1, iy)) ?? i00;
	const i01 = cluster.intensityByKey.get(keyFor(ix, iy + 1)) ?? i00;
	const i11 = cluster.intensityByKey.get(keyFor(ix + 1, iy + 1)) ?? i00;

	const top = i00 * (1 - tx) + i10 * tx;
	const bottom = i01 * (1 - tx) + i11 * tx;
	return clamp(top * (1 - ty) + bottom * ty, 0, 1);
};

export const buildRainLineLayer = (
	cells: PrecipCell[],
	timeSeconds: number,
	animationState: RainAnimationState,
	config: RainLayerConfig = DEFAULT_RAIN_LAYER_CONFIG
): ScenegraphLayer<RainSceneInstance> | null => {
	const rainyCells = cells
		.filter((cell) => cell.precipitationMmPerHour >= animationState.activeMinPrecipMmPerHour)
		.map((cell) => ({
			...cell,
			visualIntensity: clamp(cell.visualIntensity, 0, 1)
		}));

	if (!rainyCells.length) return null;

	const seamlessCells = smoothRainCells(rainyCells, config.gridStepDegrees);
	if (!seamlessCells.length) return null;

	const clusters = buildRainClusters(seamlessCells, config.gridStepDegrees);

	const instances: RainSceneInstance[] = [];

	for (let clusterIndex = 0; clusterIndex < clusters.length; clusterIndex += 1) {
		if (instances.length >= MAX_SCENEGRAPH_INSTANCES) break;
		const cluster = clusters[clusterIndex] as RainCluster;
		const centerLon = (cluster.minLon + cluster.maxLon) / 2;
		const centerLat = (cluster.minLat + cluster.maxLat) / 2;
		const [flowLon, flowLat] = sampleFlowField(centerLon, centerLat);
		const baseIntensity = cluster.avgIntensity;
		const downLon = flowLon * (0.9 + baseIntensity * 1.3);
		const downLat = flowLat * (0.9 + baseIntensity * 1.3);
		const yaw = (Math.atan2(downLon, downLat) * 180) / Math.PI;
		const pitch = 18;
		const lonPadding = config.gridStepDegrees * 0.9;
		const latPadding = config.gridStepDegrees * 0.9;
		const minLon = cluster.minLon - lonPadding;
		const maxLon = cluster.maxLon + lonPadding;
		const minLat = cluster.minLat - latPadding;
		const maxLat = cluster.maxLat + latPadding;
		const clusterWidth = maxLon - minLon;
		const clusterHeight = maxLat - minLat;
		const clusterArea = Math.max(1, clusterWidth * clusterHeight);
		const targetDrops = clamp(
			Math.round(clusterArea * (12 + baseIntensity * 20) + cluster.nodes.length * 26),
			60,
			6200
		);

		for (let dropIndex = 0; dropIndex < targetDrops; dropIndex += 1) {
			if (instances.length >= MAX_SCENEGRAPH_INSTANCES) break;

			const rng = mulberry32(seededHash(`${clusterIndex}:${dropIndex}:${centerLon}:${centerLat}`));
			const phase = rng();
			let lon = minLon + rng() * clusterWidth;
			let lat = minLat + rng() * clusterHeight;
			let localIntensity = sampleClusterIntensity(cluster, lon, lat, config.gridStepDegrees);
			if (localIntensity < 0.03) {
				lon = minLon + rng() * clusterWidth;
				lat = minLat + rng() * clusterHeight;
				localIntensity = sampleClusterIntensity(cluster, lon, lat, config.gridStepDegrees);
			}
			if (localIntensity < 0.015) continue;

			const alphaBoost = Math.round(35 + localIntensity * 120 + rng() * 36);
			const fallSpeed = 0.95 + localIntensity * 2.2 + rng() * 1.1;
			const jitterDeg = 0.035 + localIntensity * 0.11;
			const driftLon = downLon + (rng() * 2 - 1) * jitterDeg + flowLon * 0.44;
			const driftLat = downLat + (rng() * 2 - 1) * jitterDeg + flowLat * 0.44;
			const dropScaleFactor = 0.55 + rng() * 1.35;
			const wobbleYaw = (rng() * 2 - 1) * 12;
			const topAlt = 340_000 + localIntensity * 340_000;
			const dropTopAlt = topAlt * (0.85 + rng() * 0.7);

			const cycle = (timeSeconds * fallSpeed + phase) % 1;
			instances.push({
				position: [
					lon + driftLon * cycle,
					lat + driftLat * cycle,
					Math.max(0, dropTopAlt * (1 - cycle))
				],
				color: [
					122,
					185,
					255,
					clamp(120 + alphaBoost, 130, 255)
				],
				scale: [
					(2_200 + localIntensity * 4_800) * dropScaleFactor,
					(2_200 + localIntensity * 4_800) * dropScaleFactor,
					(8_400 + localIntensity * 19_000) * dropScaleFactor
				],
				orientation: [pitch, 0, yaw + wobbleYaw]
			});
		}
	}

	return new ScenegraphLayer<RainSceneInstance>({
		id: 'precipitation-rain-layer',
		data: instances,
		scenegraph: '/models/rain-drop.gltf',
		getPosition: (instance) => instance.position,
		getColor: (instance) => instance.color,
		getScale: (instance) => instance.scale,
		getOrientation: (instance) => instance.orientation,
		sizeScale: 1,
		pickable: false,
		opacity: 1
	});
};
