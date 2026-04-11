import { writable, type Readable } from 'svelte/store';

export type WeatherClockState = {
	currentTime: Date;
	minTime: Date;
	maxTime: Date;
	playing: boolean;
};

type WeatherClockController = Readable<WeatherClockState> & {
	getSnapshot: () => WeatherClockState;
	setTime: (value: Date) => void;
	jumpToNow: () => void;
	setNowReference: (value: Date | undefined) => void;
	setRange: (range: { min: Date; max: Date }) => void;
	play: () => void;
	pause: () => void;
	destroy: () => void;
};

const HOUR_MS = 60 * 60 * 1000;
const PLAYBACK_TICK_MS = 1000;

export const createWeatherClockController = (
	initialTime = new Date()
): WeatherClockController => {
	const initialTimeMs = initialTime.getTime();
	const stateStore = writable<WeatherClockState>({
		currentTime: initialTime,
		minTime: initialTime,
		maxTime: initialTime,
		playing: false
	});

	let currentTimeMs = initialTimeMs;
	let playing = false;
	let nowReferenceMs = initialTimeMs;
	let minTimeMs = initialTimeMs;
	let maxTimeMs = initialTimeMs;
	let playbackIntervalId: ReturnType<typeof setInterval> | undefined;

	const clampTime = (valueMs: number): number => Math.min(maxTimeMs, Math.max(minTimeMs, valueMs));

	const publish = (): void => {
		stateStore.set({
			currentTime: new Date(currentTimeMs),
			minTime: new Date(minTimeMs),
			maxTime: new Date(maxTimeMs),
			playing
		});
	};

	const clearPlaybackInterval = (): void => {
		if (playbackIntervalId !== undefined) {
			clearInterval(playbackIntervalId);
			playbackIntervalId = undefined;
		}
	};

	const setTime = (value: Date): void => {
		currentTimeMs = clampTime(value.getTime());
		publish();
	};

	const jumpToNow = (): void => {
		currentTimeMs = clampTime(nowReferenceMs ?? Date.now());
		publish();
	};

	const setRange = ({ min, max }: { min: Date; max: Date }): void => {
		const nextMinTimeMs = min.getTime();
		const nextMaxTimeMs = Math.max(nextMinTimeMs, max.getTime());
		minTimeMs = nextMinTimeMs;
		maxTimeMs = nextMaxTimeMs;
		nowReferenceMs = clampTime(nowReferenceMs);
		currentTimeMs = clampTime(currentTimeMs);
		if (playing && currentTimeMs >= maxTimeMs) {
			pause();
			return;
		}
		publish();
	};

	const play = (): void => {
		if (playing) return;
		if (currentTimeMs >= maxTimeMs) {
			currentTimeMs = minTimeMs;
		}
		playing = true;
		publish();
		playbackIntervalId = setInterval(() => {
			const nextTimeMs = clampTime(currentTimeMs + HOUR_MS);
			if (nextTimeMs === currentTimeMs) {
				pause();
				return;
			}
			currentTimeMs = nextTimeMs;
			if (currentTimeMs >= maxTimeMs) {
				pause();
				return;
			}
			publish();
		}, PLAYBACK_TICK_MS);
	};

	const pause = (): void => {
		if (!playing) return;
		playing = false;
		clearPlaybackInterval();
		publish();
	};

	const setNowReference = (value: Date | undefined): void => {
		nowReferenceMs = clampTime(value?.getTime() ?? Date.now());
		publish();
	};

	const destroy = (): void => {
		pause();
	};

	return {
		subscribe: stateStore.subscribe,
		getSnapshot: () => ({
			currentTime: new Date(currentTimeMs),
			minTime: new Date(minTimeMs),
			maxTime: new Date(maxTimeMs),
			playing
		}),
		setTime,
		jumpToNow,
		setNowReference,
		setRange,
		play,
		pause,
		destroy
	};
};
