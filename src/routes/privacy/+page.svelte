<script lang="ts">
	import LegalDocument from '$lib/components/LegalDocument.svelte';
	import { parseLegalMarkdown } from '$lib/legal/markdown';
	import privacyMarkdown from '../../../docs/phone_privacy.md?raw';

	const document = parseLegalMarkdown(privacyMarkdown);
</script>

<LegalDocument {document} />
