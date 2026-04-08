import { writable, type Readable } from 'svelte/store';
import type { Coordinates } from 'maplibre-gl';

type Satellite = 'goes-east' | 'goes-west';

export type CMIFrameModel = {
	frame_id: string;
	satellite: string;
	start_time: string;
	end_time: string;
	image_url: string;
	coordinates: Coordinates;
};

export type CMIFramesResponse = {
	satellite: string;
	count: number;
	poll_interval_seconds: number;
	frames: CMIFrameModel[];
};

export type CmiRasterOverlay = {
	frameId: string;
	imageUrl: string;
	coordinates: Coordinates;
};

type CmiRasterLayerControllerOptions = {
	apiPath?: string;
	satellite?: Satellite;
	visible?: boolean;
	frameLimit?: number;
	pollHintSeconds?: number;
	animationIntervalMs?: number;
};

type CmiRasterLayerController = {
	overlay: Readable<CmiRasterOverlay | undefined>;
	start: () => void;
	stop: () => void;
	setSatellite: (satellite: Satellite) => void;
	setVisible: (visible: boolean) => void;
};

const FALLBACK_POLL_INTERVAL_MS = 30_000;

const frameSortKey = (frame: CMIFrameModel): number => {
	const timestampMs = Date.parse(frame.start_time || frame.end_time);
	return Number.isFinite(timestampMs) ? timestampMs : 0;
};

export const createCmiRasterLayerController = ({
	apiPath = '/api/imagery/cmi/ch13/frames',
	satellite = 'goes-east',
	visible = true,
	frameLimit = 12,
	pollHintSeconds = 10,
	animationIntervalMs = 700
}: CmiRasterLayerControllerOptions = {}): CmiRasterLayerController => {
	const overlayStore = writable<CmiRasterOverlay | undefined>(undefined);

	const normalizedApiPath = apiPath.trim() || '/api/imagery/cmi/ch13/frames';

	let activeSatellite: Satellite = satellite;
	let weatherVisible = visible;
	let running = false;
	let pollIntervalMs = FALLBACK_POLL_INTERVAL_MS;
	let frames: CMIFrameModel[] = [];
	let currentFrameIndex = 0;
	let pollIntervalId: ReturnType<typeof setInterval> | undefined;
	let animationIntervalId: ReturnType<typeof setInterval> | undefined;

	const clearOverlay = (): void => {
		overlayStore.set(undefined);
	};

	const resetFrames = (): void => {
		frames = [];
		currentFrameIndex = 0;
	};

	const clearIntervals = (): void => {
		if (pollIntervalId !== undefined) {
			clearInterval(pollIntervalId);
			pollIntervalId = undefined;
		}
		if (animationIntervalId !== undefined) {
			clearInterval(animationIntervalId);
			animationIntervalId = undefined;
		}
	};

	const publishCurrentFrame = (): void => {
		if (!weatherVisible || frames.length === 0) {
			clearOverlay();
			return;
		}

		const frame = frames[currentFrameIndex];
		if (!frame) {
			clearOverlay();
			return;
		}

		overlayStore.set({
			frameId: frame.frame_id,
			imageUrl: frame.image_url,
			coordinates: frame.coordinates
		});
	};

	const refreshFrames = async (): Promise<void> => {
		const params = new URLSearchParams({
			satellite: activeSatellite,
			limit: String(frameLimit),
			poll_hint: String(pollHintSeconds)
		});
		const response = await fetch(`${normalizedApiPath}?${params.toString()}`);
		if (!response.ok) throw new Error(`Failed to fetch CMI frames for ${activeSatellite}`);

		const payload = (await response.json()) as CMIFramesResponse;
		frames = [...payload.frames].sort((a, b) => frameSortKey(a) - frameSortKey(b));
		currentFrameIndex = 0;
		pollIntervalMs = Math.max(1, payload.poll_interval_seconds || 0) * 1000;
		publishCurrentFrame();
	};

	const ensureAnimationLoop = (): void => {
		if (animationIntervalId !== undefined) return;
		animationIntervalId = setInterval(() => {
			if (!weatherVisible || frames.length <= 1) return;
			// Animate forward through available frames once, then hold on the latest frame
			// until fresh metadata arrives.
			if (currentFrameIndex >= frames.length - 1) return;
			currentFrameIndex += 1;
			publishCurrentFrame();
		}, animationIntervalMs);
	};

	const refreshFramesSafely = async (): Promise<void> => {
		try {
			await refreshFrames();
		} catch {
			clearOverlay();
		}
	};

	const restartPollLoop = (): void => {
		if (pollIntervalId !== undefined) clearInterval(pollIntervalId);
		pollIntervalId = setInterval(() => {
			void refreshFramesSafely();
		}, pollIntervalMs);
	};

	const startLoops = async (): Promise<void> => {
		if (!running || !weatherVisible) return;
		ensureAnimationLoop();
		await refreshFramesSafely();
		restartPollLoop();
	};

	const start = (): void => {
		if (running) return;
		running = true;
		void startLoops();
	};

	const stop = (): void => {
		running = false;
		clearIntervals();
		clearOverlay();
	};

	const setSatellite = (nextSatellite: Satellite): void => {
		if (nextSatellite === activeSatellite) return;
		activeSatellite = nextSatellite;
		resetFrames();
		if (!running || !weatherVisible) {
			clearOverlay();
			return;
		}
		void refreshFramesSafely();
	};

	const setVisible = (nextVisible: boolean): void => {
		if (weatherVisible === nextVisible) return;
		weatherVisible = nextVisible;

		if (!running) {
			if (!weatherVisible) clearOverlay();
			return;
		}

		if (!weatherVisible) {
			clearIntervals();
			clearOverlay();
			return;
		}

		void startLoops();
	};

	return {
		overlay: { subscribe: overlayStore.subscribe },
		start,
		stop,
		setSatellite,
		setVisible
	};
};
