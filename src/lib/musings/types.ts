export type Musing = {
	id: string;
	title: string | null;
	body: string;
	authorLabel: string;
	createdAt: string;
};

export type CreateMusingInput = {
	title: string | null;
	body: string;
};
