import { writable, type Readable } from 'svelte/store';

type Satellite = 'goes-east' | 'goes-west';

export type CMIFrameModel = {
	frame_id: string;
	satellite: string;
	start_time: string;
	end_time: string;
	tile_url_template: string;
};

export type CMIFramesResponse = {
	satellite: string;
	count: number;
	poll_interval_seconds: number;
	frames: CMIFrameModel[];
};

type CmiRasterLayerControllerOptions = {
	apiPath?: string;
	tilePathPrefix?: string;
	satellite?: Satellite;
	visible?: boolean;
	frameLimit?: number;
	pollHintSeconds?: number;
	animationIntervalMs?: number;
};

type CmiRasterLayerController = {
	tileTemplate: Readable<string | undefined>;
	start: () => void;
	stop: () => void;
	setSatellite: (satellite: Satellite) => void;
	setVisible: (visible: boolean) => void;
};

const FALLBACK_POLL_INTERVAL_MS = 10_000;

const isValidSatellite = (value: string): value is Satellite =>
	value === 'goes-east' || value === 'goes-west';

const frameSortKey = (frame: CMIFrameModel): number => {
	const timestampMs = Date.parse(frame.start_time || frame.end_time);
	return Number.isFinite(timestampMs) ? timestampMs : 0;
};

const buildTileTemplate = (tilePathPrefix: string, satellite: Satellite, frameId: string): string =>
	`${tilePathPrefix}/${satellite}/${encodeURIComponent(frameId)}/{z}/{x}/{y}.png`;

export const createCmiRasterLayerController = ({
	apiPath = '/api/imagery/cmi/ch13/frames',
	tilePathPrefix = '/api/imagery/cmi/ch13/tiles',
	satellite = 'goes-east',
	visible = true,
	frameLimit = 12,
	pollHintSeconds = 10,
	animationIntervalMs = 700
}: CmiRasterLayerControllerOptions): CmiRasterLayerController => {
	const tileTemplateStore = writable<string | undefined>(undefined);

	const normalizedApiPath = apiPath.trim() || '/api/imagery/cmi/ch13/frames';
	const normalizedTilePathPrefix = tilePathPrefix.replace(/\/+$/, '') || '/api/imagery/cmi/ch13/tiles';

	let activeSatellite: Satellite = satellite;
	let weatherVisible = visible;
	let running = false;
	let pollIntervalMs = FALLBACK_POLL_INTERVAL_MS;
	let frames: CMIFrameModel[] = [];
	let currentFrameIndex = 0;
	let pollIntervalId: ReturnType<typeof setInterval> | undefined;
	let animationIntervalId: ReturnType<typeof setInterval> | undefined;

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
			tileTemplateStore.set(undefined);
			return;
		}

		const frame = frames[currentFrameIndex];
		if (!frame) {
			tileTemplateStore.set(undefined);
			return;
		}

		tileTemplateStore.set(
			buildTileTemplate(normalizedTilePathPrefix, activeSatellite, frame.frame_id)
		);
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

	const startAnimationLoop = (): void => {
		if (animationIntervalId !== undefined) return;
		animationIntervalId = setInterval(() => {
			if (!weatherVisible || frames.length <= 1) return;
			currentFrameIndex = (currentFrameIndex + 1) % frames.length;
			publishCurrentFrame();
		}, animationIntervalMs);
	};

	const startPollLoop = (): void => {
		if (pollIntervalId !== undefined) clearInterval(pollIntervalId);
		pollIntervalId = setInterval(() => {
			void refreshFrames();
		}, pollIntervalMs);
	};

	const startLoops = async (): Promise<void> => {
		if (!running || !weatherVisible) return;
		startAnimationLoop();
		try {
			await refreshFrames();
		} catch {
			tileTemplateStore.set(undefined);
		}
		startPollLoop();
	};

	const start = (): void => {
		if (running) return;
		running = true;
		void startLoops();
	};

	const stop = (): void => {
		running = false;
		clearIntervals();
		tileTemplateStore.set(undefined);
	};

	const setSatellite = (nextSatellite: Satellite): void => {
		if (!isValidSatellite(nextSatellite) || nextSatellite === activeSatellite) return;
		activeSatellite = nextSatellite;
		frames = [];
		currentFrameIndex = 0;
		if (!running || !weatherVisible) {
			tileTemplateStore.set(undefined);
			return;
		}
		void refreshFrames();
	};

	const setVisible = (nextVisible: boolean): void => {
		if (weatherVisible === nextVisible) return;
		weatherVisible = nextVisible;

		if (!running) {
			if (!weatherVisible) tileTemplateStore.set(undefined);
			return;
		}

		if (!weatherVisible) {
			clearIntervals();
			tileTemplateStore.set(undefined);
			return;
		}

		void startLoops();
	};

	return {
		tileTemplate: { subscribe: tileTemplateStore.subscribe },
		start,
		stop,
		setSatellite,
		setVisible
	};
};
