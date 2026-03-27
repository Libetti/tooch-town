import type { CustomLayerInterface, CustomRenderMethodInput, Map } from 'maplibre-gl';
import * as THREE from 'three';
import { loadCachedModelSceneClone } from './gltf-model-cache';

export type SpaceBattleShipPlacement = {
	id?: string;
	modelUrl: string;
	longitude: number;
	latitude: number;
	altitudeMeters?: number;
	scaleMeters?: number;
	rotationDeg?: [number, number, number];
};

export type SpaceBattleLayerOptions = {
	layerId?: string;
	ships: SpaceBattleShipPlacement[];
	visible?: boolean;
	beforeLayerId?: string;
	defaultAltitudeMeters?: number;
	defaultScaleMeters?: number;
	defaultRotationDeg?: [number, number, number];
};

type MountedShip = {
	placement: SpaceBattleShipPlacement;
	anchor: THREE.Group;
	fallbackMesh?: THREE.Mesh;
	fallbackMaterial?: THREE.MeshStandardMaterial;
};

type SpaceBattleCustomLayer = CustomLayerInterface & {
	setVisibility: (visible: boolean) => void;
};

const applyRotation = (target: THREE.Object3D, rotationDeg: [number, number, number]) => {
	target.rotation.set(
		THREE.MathUtils.degToRad(rotationDeg[0]),
		THREE.MathUtils.degToRad(rotationDeg[1]),
		THREE.MathUtils.degToRad(rotationDeg[2])
	);
};

const disposeObject3D = (object: THREE.Object3D): void => {
	object.traverse((node) => {
		const mesh = node as THREE.Mesh;
		if (!mesh.isMesh) return;

		mesh.geometry?.dispose();
		if (Array.isArray(mesh.material)) {
			mesh.material.forEach((material) => material.dispose());
			return;
		}
		mesh.material?.dispose();
	});
};

export const createSpaceBattleLayer = ({
	layerId = 'space-battle-layer',
	ships,
	visible = true,
	defaultAltitudeMeters = 900_000,
	defaultScaleMeters = 60_000,
	defaultRotationDeg = [0, 0, 0]
}: SpaceBattleLayerOptions): SpaceBattleCustomLayer => {
	let mapRef: Map | undefined;
	let renderer: THREE.WebGLRenderer | undefined;
	const mountedShips: MountedShip[] = [];
	let disposed = false;
	let layerGeneration = 0;
	let isVisible = visible;

	const camera = new THREE.Camera();
	const scene = new THREE.Scene();

	scene.add(new THREE.AmbientLight(0xffffff, 0.9));
	const keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
	keyLight.position.set(1, -0.4, 0.3);
	scene.add(keyLight);

	return {
		id: layerId,
		type: 'custom',
		renderingMode: '3d',

		onAdd(map, gl) {
			disposed = false;
			layerGeneration += 1;
			const activeGeneration = layerGeneration;

			mapRef = map;

			renderer = new THREE.WebGLRenderer({
				canvas: map.getCanvas(),
				context: gl,
				antialias: true
			});
			renderer.autoClear = false;

			for (const placement of ships) {
				const anchor = new THREE.Group();
				anchor.matrixAutoUpdate = false;
				scene.add(anchor);

				const fallbackMaterial = new THREE.MeshStandardMaterial({
					color: 0x9fa8b5,
					roughness: 0.55,
					metalness: 0.7
				});
				const fallbackMesh = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3, 6), fallbackMaterial);
				fallbackMesh.rotation.x = Math.PI / 2;
				fallbackMesh.frustumCulled = false;
				applyRotation(fallbackMesh, placement.rotationDeg ?? defaultRotationDeg);
				anchor.add(fallbackMesh);

				const mountedShip: MountedShip = { placement, anchor, fallbackMesh, fallbackMaterial };
				mountedShips.push(mountedShip);

				void loadCachedModelSceneClone(placement.modelUrl)
					.then((sceneClone) => {
						if (disposed || activeGeneration !== layerGeneration) return;

						const shipModel = sceneClone;
						shipModel.traverse((node) => {
							node.frustumCulled = false;
						});
						applyRotation(shipModel, placement.rotationDeg ?? defaultRotationDeg);

						anchor.clear();
						anchor.add(shipModel);

						if (mountedShip.fallbackMesh) {
							mountedShip.fallbackMesh.geometry.dispose();
							mountedShip.fallbackMesh = undefined;
						}
						mountedShip.fallbackMaterial?.dispose();
						mountedShip.fallbackMaterial = undefined;
					})
					.catch((error) => {
						if (disposed || activeGeneration !== layerGeneration) return;
						console.error(`[space-battle-layer] Failed to load model: ${placement.modelUrl}`, error);
					});
			}
		},

		render(_gl, options: CustomRenderMethodInput) {
			if (!renderer || !mapRef || disposed) return;
			if (!isVisible) return;

			const globeMatrix = new THREE.Matrix4().fromArray(
				options.defaultProjectionData.mainMatrix as unknown as number[]
			);
			camera.projectionMatrix.copy(globeMatrix);

			for (const mountedShip of mountedShips) {
				const { placement, anchor } = mountedShip;
				const altitudeMeters = placement.altitudeMeters ?? defaultAltitudeMeters;
				const scaleMeters = placement.scaleMeters ?? defaultScaleMeters;

				const modelMatrix = new THREE.Matrix4().fromArray(
					(
						(mapRef as unknown as {
							transform: {
								getMatrixForModel: (location: [number, number], altitude?: number) => number[];
							};
						}).transform.getMatrixForModel(
							[placement.longitude, placement.latitude],
							Math.max(0, altitudeMeters)
						)
					) as number[]
				);

				const scaleMatrix = new THREE.Matrix4().makeScale(scaleMeters, scaleMeters, scaleMeters);
				anchor.matrix.copy(modelMatrix.multiply(scaleMatrix));
				anchor.matrixWorldNeedsUpdate = true;
			}

			renderer.resetState();
			renderer.render(scene, camera);
			mapRef.triggerRepaint();
		},

		setVisibility(visibleState: boolean) {
			isVisible = visibleState;
			mapRef?.triggerRepaint();
		},

		onRemove() {
			disposed = true;
			layerGeneration += 1;
			for (const mountedShip of mountedShips) {
				const { anchor, fallbackMesh, fallbackMaterial } = mountedShip;
				if (fallbackMesh) {
					fallbackMesh.geometry.dispose();
				}
				fallbackMaterial?.dispose();

				anchor.children.forEach((child) => disposeObject3D(child));
				anchor.clear();
				scene.remove(anchor);
			}
			mountedShips.length = 0;

			renderer?.dispose();
			renderer = undefined;
			mapRef = undefined;
		}
	} as SpaceBattleCustomLayer;
};

export type SpaceBattleLayerController = {
	setVisible: (visible: boolean) => void;
	destroy: () => void;
};

export const mountSpaceBattleLayer = (
	map: Map,
	options: SpaceBattleLayerOptions
): SpaceBattleLayerController => {
	const layer = createSpaceBattleLayer(options) as SpaceBattleCustomLayer;
	const layerId = layer.id;
	let active = true;

	const tryAdd = () => {
		if (!active) return;
		if (map.getLayer(layerId)) return;

		const style = map.getStyle();
		if (!style || !style.layers) return;

		try {
			const beforeLayerId =
				options.beforeLayerId && map.getLayer(options.beforeLayerId)
					? options.beforeLayerId
					: undefined;
			map.addLayer(layer, beforeLayerId);
		} catch {
			// Retry during subsequent style lifecycle events.
		}
	};

	const onStyleLoad = () => tryAdd();
	const onIdle = () => tryAdd();

	tryAdd();
	layer.setVisibility(options.visible ?? true);
	map.on('style.load', onStyleLoad);
	map.on('idle', onIdle);

	const destroy = () => {
		active = false;
		map.off('style.load', onStyleLoad);
		map.off('idle', onIdle);

		if (map.getLayer(layerId)) {
			map.removeLayer(layerId);
		}
	};

	return {
		setVisible(visible) {
			layer.setVisibility(visible);
		},
		destroy
	};
};
