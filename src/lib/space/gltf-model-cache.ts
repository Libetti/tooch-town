import type { Object3D, WebGLRenderer } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const ktx2Loader = new KTX2Loader();
const gltfPromiseCache = new Map<string, Promise<GLTF>>();
let ktx2Configured = false;

const ensureKtx2Support = (renderer?: WebGLRenderer): void => {
	if (!renderer || ktx2Configured) return;

	ktx2Loader.setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.183.2/examples/jsm/libs/basis/');
	ktx2Loader.detectSupport(renderer);
	loader.setKTX2Loader(ktx2Loader);
	ktx2Configured = true;
};

const getOrLoadGltf = (modelUrl: string, renderer?: WebGLRenderer): Promise<GLTF> => {
	ensureKtx2Support(renderer);

	const cached = gltfPromiseCache.get(modelUrl);
	if (cached) return cached;

	const loadPromise = loader.loadAsync(modelUrl).catch((error) => {
		gltfPromiseCache.delete(modelUrl);
		throw error;
	});
	gltfPromiseCache.set(modelUrl, loadPromise);
	return loadPromise;
};

export const loadCachedModelSceneClone = async (
	modelUrl: string,
	renderer?: WebGLRenderer
): Promise<Object3D> => {
	const gltf = await getOrLoadGltf(modelUrl, renderer);
	return cloneSkinned(gltf.scene);
};
