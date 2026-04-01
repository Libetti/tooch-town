import { json } from '@sveltejs/kit';
import {
	createSupabaseServerClient,
	hasSupabaseAuthConfig,
	persistSupabaseSession
} from '$lib/server/supabase';
import { jsonSupabaseConfigError, normalizePhone } from '$lib/server/auth';
import type { RequestHandler } from './$types';

type PhoneVerifyBody = {
	phone?: string;
	token?: string;
};

export const POST: RequestHandler = async ({ cookies, request }) => {
	if (!hasSupabaseAuthConfig) {
		return jsonSupabaseConfigError();
	}

	let body: PhoneVerifyBody;

	try {
		body = (await request.json()) as PhoneVerifyBody;
	} catch {
		return json({ error: 'Invalid phone verification payload.' }, { status: 400 });
	}

	const phone = normalizePhone(body.phone ?? '');
	const token = body.token?.trim() ?? '';

	if (!phone) {
		return json({ error: 'Enter the phone number you used to sign up.' }, { status: 400 });
	}

	if (!token) {
		return json({ error: 'Enter the verification code from your text message.' }, { status: 400 });
	}

	try {
		const supabase = createSupabaseServerClient();
		const { data, error } = await supabase.auth.verifyOtp({
			phone,
			token,
			type: 'sms'
		});

		if (error || !data.session) {
			return json(
				{
					error:
						error?.message ?? 'Your phone was verified, but we could not finish your account setup.'
				},
				{ status: 400 }
			);
		}

		persistSupabaseSession(cookies, data.session);
		return json({ session: data.session });
	} catch {
		return json({ error: 'Unable to verify your code right now.' }, { status: 500 });
	}
};
