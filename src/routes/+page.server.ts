import type { PageServerLoad } from './$types';

const DEFAULT_CENTER: [number, number] = [-75.5663, 39.662];

type IpGeoResponse = {
	error?: boolean;
	latitude?: number | string;
	longitude?: number | string;
};

const sanitizeIp = (raw: string | null): string | null => {
	if (!raw) return null;

	let value = raw.trim();
	if (!value || value.toLowerCase() === 'unknown') return null;

	if (value.startsWith('::ffff:')) value = value.slice(7);

	// Handle common "ip:port" form for IPv4.
	if (value.includes('.') && value.includes(':')) {
		const firstColon = value.indexOf(':');
		value = value.slice(0, firstColon);
	}

	return value || null;
};

const isPrivateOrLocalIp = (ip: string): boolean => {
	const lower = ip.toLowerCase();

	if (
		lower === '::1' ||
		lower === 'localhost' ||
		lower.startsWith('fe80:') ||
		lower.startsWith('fc') ||
		lower.startsWith('fd')
	) {
		return true;
	}

	if (!ip.includes('.')) return false;

	const parts = ip.split('.').map((part) => Number(part));
	if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
		return false;
	}

	const [a, b] = parts;
	return (
		a === 10 ||
		a === 127 ||
		(a === 192 && b === 168) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 169 && b === 254)
	);
};

const getClientIp = (event: Parameters<PageServerLoad>[0]): string | null => {
	const forwarded = event.request.headers.get('x-forwarded-for');
	if (forwarded) {
		const firstForwardedIp = sanitizeIp(forwarded.split(',')[0] ?? null);
		if (firstForwardedIp) return firstForwardedIp;
	}

	const realIp = sanitizeIp(event.request.headers.get('x-real-ip'));
	if (realIp) return realIp;

	const cfIp = sanitizeIp(event.request.headers.get('cf-connecting-ip'));
	if (cfIp) return cfIp;

	try {
		return sanitizeIp(event.getClientAddress());
	} catch {
		return null;
	}
};

const geolocateIp = async (
	fetchFn: typeof fetch,
	ip: string
): Promise<[number, number] | null> => {
	const abortController = new AbortController();
	const timeout = setTimeout(() => abortController.abort(), 2500);

	try {
		const response = await fetchFn(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
			headers: { accept: 'application/json' },
			signal: abortController.signal
		});

		if (!response.ok) return null;

		const body = (await response.json()) as IpGeoResponse;
		if (body.error) return null;

		const latitude = Number(body.latitude);
		const longitude = Number(body.longitude);

		if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
		if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

		return [longitude, latitude];
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
	}
};

export const load: PageServerLoad = async (event) => {
	const ip = getClientIp(event);
	if (!ip || isPrivateOrLocalIp(ip)) {
		return { initialCenter: DEFAULT_CENTER };
	}

	const geocodedCenter = await geolocateIp(event.fetch, ip);
	return { initialCenter: geocodedCenter ?? DEFAULT_CENTER };
};
