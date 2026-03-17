import type { BaseLayerId } from '$lib/maps/base-layer-ids';

export type WeatherSatelliteId = 'goes-east' | 'goes-west';

export type BaseMapOption = {
	id: BaseLayerId;
	label: string;
};

export type ToggleControlDefinition = {
	kind: 'toggle';
	id: string;
	label: string;
	value: boolean;
	description?: string;
	disabled?: boolean;
};

export type SelectControlDefinition = {
	kind: 'select';
	id: string;
	label: string;
	value: string;
	description?: string;
	disabled?: boolean;
	options: Array<{
		value: string;
		label: string;
	}>;
};

export type SliderControlDefinition = {
	kind: 'slider';
	id: string;
	label: string;
	value: number;
	min: number;
	max: number;
	step?: number;
	description?: string;
	disabled?: boolean;
};

export type ControlDefinition =
	| ToggleControlDefinition
	| SelectControlDefinition
	| SliderControlDefinition;

export type LayerDefinition = {
	id: string;
	label: string;
	enabled: boolean;
	description?: string;
	controls?: ControlDefinition[];
};

export type LayerRegistry = {
	baseMaps: BaseMapOption[];
	layers: LayerDefinition[];
};
