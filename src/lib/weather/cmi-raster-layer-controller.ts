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

type CmiTimelineFrame = CMIFrameModel & {
	timestampMs: number;
};

type CmiRasterLayerControllerOptions = {
	apiPath?: string;
	satellite?: Satellite;
	visible?: boolean;
	frameLimit?: number;
	pollHintSeconds?: number;
	historyWindowMs?: number;
};

type CmiRasterLayerController = {
	overlay: Readable<CmiRasterOverlay | undefined>;
	earliestAvailableTime: Readable<Date | undefined>;
	latestAvailableTime: Readable<Date | undefined>;
	start: () => void;
	stop: () => void;
	setSatellite: (satellite: Satellite) => void;
	setVisible: (visible: boolean) => void;
	setTime: (value: Date) => void;
};

const CMI_FRAME_LIMIT = 1000;
const CMI_POLL_HINT_SECONDS = 3600;
const CMI_HISTORY_WINDOW_MS = 48 * 60 * 60 * 1000;
const FALLBACK_POLL_INTERVAL_MS = 30_000;

const frameSortKey = (frame: CMIFrameModel): number => {
	const timestampMs = Date.parse(frame.start_time || frame.end_time);
	return Number.isFinite(timestampMs) ? timestampMs : 0;
};

const normalizeFrame = (frame: CMIFrameModel): CmiTimelineFrame => ({
	...frame,
	timestampMs: frameSortKey(frame)
});

export const createCmiRasterLayerController = ({
	apiPath = '/api/imagery/cmi/ch13/frames',
	satellite = 'goes-east',
	visible = true,
	frameLimit = CMI_FRAME_LIMIT,
	pollHintSeconds = CMI_POLL_HINT_SECONDS,
	historyWindowMs = CMI_HISTORY_WINDOW_MS
}: CmiRasterLayerControllerOptions = {}): CmiRasterLayerController => {
	const overlayStore = writable<CmiRasterOverlay | undefined>(undefined);
	const earliestAvailableTimeStore = writable<Date | undefined>(undefined);
	const latestAvailableTimeStore = writable<Date | undefined>(undefined);

	const normalizedApiPath = apiPath.trim() || '/api/imagery/cmi/ch13/frames';

	let activeSatellite: Satellite = satellite;
	let weatherVisible = visible;
	let running = false;
	let pollIntervalMs = FALLBACK_POLL_INTERVAL_MS;
	let frames: CmiTimelineFrame[] = [];
	let requestedTimeMs = Date.now();
	let currentOverlay: CmiRasterOverlay | undefined;
	let pollIntervalId: ReturnType<typeof setInterval> | undefined;

	const clearOverlay = (): void => {
		currentOverlay = undefined;
		overlayStore.set(undefined);
	};

	const resetFrames = (): void => {
		frames = [];
		earliestAvailableTimeStore.set(undefined);
		latestAvailableTimeStore.set(undefined);
	};

	const clearPollLoop = (): void => {
		if (pollIntervalId !== undefined) {
			clearInterval(pollIntervalId);
			pollIntervalId = undefined;
		}
	};

	const publishFrame = (frame: CmiTimelineFrame | undefined): void => {
		if (!weatherVisible || !frame) {
			clearOverlay();
			return;
		}

		const overlay = {
			frameId: frame.frame_id,
			imageUrl: frame.image_url,
			coordinates: frame.coordinates
		};
		currentOverlay = overlay;
		overlayStore.set(overlay);
	};

	const resolveFrameForRequestedTime = (): CmiTimelineFrame | undefined => {
		if (frames.length === 0) return undefined;
		const latestFrame = frames[frames.length - 1];
		if (requestedTimeMs > latestFrame.timestampMs) return undefined;

		let bestAtOrBefore: CmiTimelineFrame | undefined;
		for (const frame of frames) {
			if (frame.timestampMs <= requestedTimeMs) {
				bestAtOrBefore = frame;
				continue;
			}
			break;
		}
		if (bestAtOrBefore) return bestAtOrBefore;

		let nearestFrame = frames[0];
		let nearestDistance = Math.abs(frames[0].timestampMs - requestedTimeMs);
		for (const frame of frames) {
			const distance = Math.abs(frame.timestampMs - requestedTimeMs);
			if (distance < nearestDistance) {
				nearestDistance = distance;
				nearestFrame = frame;
			}
		}
		return nearestFrame;
	};

	const publishRequestedFrame = (): void => {
		publishFrame(resolveFrameForRequestedTime());
	};

	const refreshFrames = async (): Promise<void> => {
		const end = new Date();
		const start = new Date(end.getTime() - historyWindowMs);
		const params = new URLSearchParams({
			satellite: activeSatellite,
			start: start.toISOString(),
			end: end.toISOString(),
			limit: String(frameLimit),
			poll_hint: String(pollHintSeconds)
		});
		const response = await fetch(`${normalizedApiPath}?${params.toString()}`);
		if (!response.ok) throw new Error(`Failed to fetch CMI frames for ${activeSatellite}`);

		const payload = (await response.json()) as CMIFramesResponse;
		frames = [...payload.frames].sort((a, b) => frameSortKey(a) - frameSortKey(b)).map(normalizeFrame);
		pollIntervalMs = Math.max(1, payload.poll_interval_seconds || 0) * 1000;
		earliestAvailableTimeStore.set(
			frames.length > 0 ? new Date(frames[0].timestampMs) : undefined
		);
		latestAvailableTimeStore.set(
			frames.length > 0 ? new Date(frames[frames.length - 1].timestampMs) : undefined
		);
		publishRequestedFrame();
	};

	const refreshFramesSafely = async (): Promise<void> => {
		try {
			await refreshFrames();
		} catch {
			if (!currentOverlay) clearOverlay();
		}
	};

	const restartPollLoop = (): void => {
		clearPollLoop();
		pollIntervalId = setInterval(() => {
			void refreshFramesSafely();
		}, pollIntervalMs);
	};

	const startLoops = async (): Promise<void> => {
		if (!running || !weatherVisible) return;
		await refreshFramesSafely();
		if (!running || !weatherVisible) return;
		restartPollLoop();
	};

	const start = (): void => {
		if (running) return;
		running = true;
		void startLoops();
	};

	const stop = (): void => {
		running = false;
		clearPollLoop();
		clearOverlay();
	};

	const setSatellite = (nextSatellite: Satellite): void => {
		if (nextSatellite === activeSatellite) return;
		activeSatellite = nextSatellite;
		resetFrames();
		clearOverlay();
		if (!running || !weatherVisible) return;
		void startLoops();
	};

	const setVisible = (nextVisible: boolean): void => {
		if (weatherVisible === nextVisible) return;
		weatherVisible = nextVisible;

		if (!running) {
			if (!weatherVisible) clearOverlay();
			return;
		}

		if (!weatherVisible) {
			clearPollLoop();
			clearOverlay();
			return;
		}

		if (frames.length > 0) {
			publishRequestedFrame();
		}
		void startLoops();
	};

	const setTime = (value: Date): void => {
		requestedTimeMs = value.getTime();
		if (!weatherVisible) return;
		publishRequestedFrame();
	};

	return {
		overlay: { subscribe: overlayStore.subscribe },
		earliestAvailableTime: { subscribe: earliestAvailableTimeStore.subscribe },
		latestAvailableTime: { subscribe: latestAvailableTimeStore.subscribe },
		start,
		stop,
		setSatellite,
		setVisible,
		setTime
	};
};
