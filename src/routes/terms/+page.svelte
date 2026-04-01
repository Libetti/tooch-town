<script lang="ts">
	import LegalDocument from '$lib/components/LegalDocument.svelte';
	import { parseLegalMarkdown } from '$lib/legal/markdown';
	import termsMarkdown from '../../../docs/phone_tos.md?raw';

	const document = parseLegalMarkdown(termsMarkdown);
</script>

<LegalDocument {document} />
