import type { CustomLayerInterface, CustomRenderMethodInput, Map } from 'maplibre-gl';
import * as THREE from 'three';
import { loadCachedModelSceneClone } from './gltf-model-cache';

export type MoonOrbitLayerOptions = {
	layerId?: string;
	modelUrl: string;
	orbitPeriodSeconds?: number;
	orbitAltitudeMeters?: number;
	orbitInclinationDeg?: number;
	modelScaleMeters?: number;
	initialPhaseDeg?: number;
	modelRotationDeg?: [number, number, number];
};

const wrapLongitude = (longitude: number): number => ((((longitude + 180) % 360) + 360) % 360) - 180;

export const createMoonOrbitLayer = ({
	layerId = 'moon-orbit-layer',
	modelUrl,
	orbitPeriodSeconds = 30,
	orbitAltitudeMeters = 450_000,
	orbitInclinationDeg = 23.5,
	modelScaleMeters = 50_000,
	initialPhaseDeg = 0
}: MoonOrbitLayerOptions): CustomLayerInterface => {
	let mapRef: Map | undefined;
	let renderer: THREE.WebGLRenderer | undefined;
	const camera = new THREE.Camera();
	const scene = new THREE.Scene();
	let moonModel: THREE.Object3D | undefined;
	let fallbackMoon: THREE.Mesh | undefined;
	let fallbackMaterial: THREE.MeshStandardMaterial | undefined;
	let startMs = 0;
	let baseOrbitLng = 0;
	let disposed = false;
	let layerGeneration = 0;
	let didWarnOnSlowLoad = false;
	let slowLoadWarningTimeout: ReturnType<typeof setTimeout> | undefined;

	scene.add(new THREE.AmbientLight(0xffffff, 0.8));
	const sunLight = new THREE.DirectionalLight(0xffffff, 1.25);
	sunLight.position.set(1, 0, 0.2);
	scene.add(sunLight);

	return {
		id: layerId,
		type: 'custom',
		renderingMode: '3d',

		onAdd(map, gl) {
			disposed = false;
			layerGeneration += 1;
			const activeGeneration = layerGeneration;

			mapRef = map;
			startMs = performance.now();
			baseOrbitLng = map.getCenter().lng;
			renderer = new THREE.WebGLRenderer({
				canvas: map.getCanvas(),
				context: gl,
				antialias: true
			});
			renderer.autoClear = false;

			// Always show a body immediately while GLB loads.
			fallbackMaterial = new THREE.MeshStandardMaterial({
				color: 0xffffff,
				roughness: 0.9,
				metalness: 0.05
			});
			fallbackMoon = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 24), fallbackMaterial);
			scene.add(fallbackMoon);

			slowLoadWarningTimeout = setTimeout(() => {
				if (disposed || moonModel || didWarnOnSlowLoad) return;
				didWarnOnSlowLoad = true;
				console.warn(`[moon-orbit-layer] Model is still loading: ${modelUrl}`);
			}, 4000);

			void loadCachedModelSceneClone(modelUrl)
				.then((sceneClone) => {
					if (disposed || activeGeneration !== layerGeneration) return;

					if (moonModel) {
						scene.remove(moonModel);
					}
					moonModel = sceneClone;
					scene.add(moonModel);
					if (fallbackMoon) {
						scene.remove(fallbackMoon);
						fallbackMoon.geometry.dispose();
						fallbackMaterial?.dispose();
						fallbackMoon = undefined;
						fallbackMaterial = undefined;
					}
				})
				.catch((error) => {
					if (disposed || activeGeneration !== layerGeneration) return;
					console.error(`[moon-orbit-layer] Failed to load model: ${modelUrl}`, error);
				});
		},

		render(gl, options: CustomRenderMethodInput) {
			if (!renderer || !mapRef || disposed) return;

			const elapsedSeconds = (performance.now() - startMs) / 1000;
			const cycle = (elapsedSeconds / Math.max(orbitPeriodSeconds, 0.001)) % 1;
			const angleRad = cycle * Math.PI * 2 + THREE.MathUtils.degToRad(initialPhaseDeg);
			const orbitLng = wrapLongitude(baseOrbitLng + THREE.MathUtils.radToDeg(angleRad));
			const orbitLat = Math.sin(angleRad) * orbitInclinationDeg;


			const modelMatrix = new THREE.Matrix4().fromArray(
				(
					(mapRef as unknown as {
						transform: {
							getMatrixForModel: (location: [number, number], altitude?: number) => number[];
						};
					}).transform.getMatrixForModel([orbitLng, orbitLat], Math.max(0, orbitAltitudeMeters))
				) as number[]
			);
			const globeMatrix = new THREE.Matrix4().fromArray(
				options.defaultProjectionData.mainMatrix as unknown as number[]
			);

			const scaleMatrix = new THREE.Matrix4().makeScale(
				modelScaleMeters,
				modelScaleMeters,
				modelScaleMeters
			);
			camera.projectionMatrix = globeMatrix.multiply(modelMatrix).multiply(scaleMatrix);

			renderer.resetState();
			renderer.render(scene, camera);
			mapRef.triggerRepaint();
		},

		onRemove() {
			disposed = true;
			layerGeneration += 1;
			if (slowLoadWarningTimeout !== undefined) {
				clearTimeout(slowLoadWarningTimeout);
				slowLoadWarningTimeout = undefined;
			}
			if (moonModel) {
				scene.remove(moonModel);
				moonModel = undefined;
			}
			if (fallbackMoon) {
				scene.remove(fallbackMoon);
				fallbackMoon.geometry.dispose();
				fallbackMoon = undefined;
			}
			fallbackMaterial?.dispose();
			fallbackMaterial = undefined;
			renderer?.dispose();
			renderer = undefined;
			mapRef = undefined;
		}
	};
};

export const mountMoonOrbitLayer = (
	map: Map,
	options: MoonOrbitLayerOptions
): (() => void) => {
	const layer = createMoonOrbitLayer(options);
	const layerId = layer.id;
	let active = true;

	const tryAdd = () => {
		if (!active) return;
		if (map.getLayer(layerId)) return;

		// Guard style readiness without depending on a single 'load' event.
		const style = map.getStyle();
		if (!style || !style.layers) return;

		try {
			map.addLayer(layer);
		} catch {
			// Style/projection can still be mid-transition; idle/style.load will retry.
		}
	};

	const onStyleLoad = () => tryAdd();
	const onIdle = () => tryAdd();

	// Try immediately, then retry on style lifecycle events.
	tryAdd();
	map.on('style.load', onStyleLoad);
	map.on('idle', onIdle);

	return () => {
		active = false;
		map.off('style.load', onStyleLoad);
		map.off('idle', onIdle);

		if (map.getLayer(layerId)) {
			map.removeLayer(layerId);
		}
	};
};
