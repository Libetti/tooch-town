import { Country, State } from 'country-state-city';

export type CountryOption = {
	name: string;
	isoCode: string;
};

export type StateOption = {
	name: string;
	isoCode: string;
	countryCode: string;
};

export const countryOptions: CountryOption[] = Country.getAllCountries()
	.map((country) => ({
		name: country.name,
		isoCode: country.isoCode
	}))
	.sort((left, right) => left.name.localeCompare(right.name));

export const getStateOptions = (countryCode: string): StateOption[] =>
	State.getStatesOfCountry(countryCode)
		.map((state) => ({
			name: state.name,
			isoCode: state.isoCode,
			countryCode: state.countryCode
		}))
		.sort((left, right) => left.name.localeCompare(right.name));
