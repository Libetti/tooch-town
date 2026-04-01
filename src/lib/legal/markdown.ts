export type LegalBlock =
	| { type: 'paragraph'; text: string }
	| { type: 'list'; items: string[] }
	| { type: 'section'; heading: string; blocks: LegalBlock[] };

export type LegalDocument = {
	title: string;
	effectiveDate: string | null;
	intro: LegalBlock[];
	sections: Array<{ heading: string; blocks: LegalBlock[] }>;
};

const parseBlocks = (lines: string[]): LegalBlock[] => {
	const blocks: LegalBlock[] = [];
	let paragraphLines: string[] = [];
	let listItems: string[] = [];

	const flushParagraph = () => {
		if (paragraphLines.length === 0) return;
		blocks.push({
			type: 'paragraph',
			text: paragraphLines.join(' ')
		});
		paragraphLines = [];
	};

	const flushList = () => {
		if (listItems.length === 0) return;
		blocks.push({
			type: 'list',
			items: listItems
		});
		listItems = [];
	};

	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line || line === '---') {
			flushParagraph();
			flushList();
			continue;
		}

		if (line.startsWith('- ') || line.startsWith('* ')) {
			flushParagraph();
			listItems.push(line.slice(2).trim());
			continue;
		}

		flushList();
		paragraphLines.push(line);
	}

	flushParagraph();
	flushList();

	return blocks;
};

export const parseLegalMarkdown = (markdown: string): LegalDocument => {
	const lines = markdown.split('\n');
	const titleLine = lines.find((line) => line.trim().startsWith('# '));
	const title = titleLine?.trim().slice(2).trim() ?? 'Document';
	const effectiveDateLine = lines.find((line) => line.trim().startsWith('**Effective Date:**'));
	const effectiveDate = effectiveDateLine
		? effectiveDateLine.trim().replace(/^\*\*Effective Date:\*\*\s*/, '')
		: null;

	const introLines: string[] = [];
	const sections: Array<{ heading: string; lines: string[] }> = [];
	let currentSection: { heading: string; lines: string[] } | null = null;
	let startedBody = false;

	for (const rawLine of lines) {
		const line = rawLine.trim();

		if (!startedBody) {
			if (!line || line === '---' || line.startsWith('# ') || line.startsWith('**Effective Date:**')) {
				continue;
			}

			if (line.startsWith('## ')) {
				startedBody = true;
			} else {
				introLines.push(rawLine);
				continue;
			}
		}

		if (line.startsWith('## ')) {
			currentSection = { heading: line.slice(3).trim(), lines: [] };
			sections.push(currentSection);
			continue;
		}

		currentSection?.lines.push(rawLine);
	}

	return {
		title,
		effectiveDate,
		intro: parseBlocks(introLines),
		sections: sections.map((section) => ({
			heading: section.heading,
			blocks: parseBlocks(section.lines)
		}))
	};
};

const escapeHtml = (text: string): string =>
	text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');

export const renderInlineMarkdown = (text: string): string => {
	let html = escapeHtml(text);

	html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
	html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

	return html;
};
