import type { Object3D } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const gltfPromiseCache = new Map<string, Promise<GLTF>>();

const getOrLoadGltf = (modelUrl: string): Promise<GLTF> => {
	const cached = gltfPromiseCache.get(modelUrl);
	if (cached) return cached;

	const loadPromise = loader.loadAsync(modelUrl).catch((error) => {
		gltfPromiseCache.delete(modelUrl);
		throw error;
	});
	gltfPromiseCache.set(modelUrl, loadPromise);
	return loadPromise;
};

export const loadCachedModelSceneClone = async (modelUrl: string): Promise<Object3D> => {
	const gltf = await getOrLoadGltf(modelUrl);
	return cloneSkinned(gltf.scene);
};
