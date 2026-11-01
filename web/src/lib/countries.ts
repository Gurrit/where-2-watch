// Regions TMDB reports watch-provider data for (ISO 3166-1 alpha-2). Names come from Intl.
export const COUNTRY_CODES = [
  'AR','AT','AU','BE','BR','CA','CH','CL','CO','CZ','DE','DK','EC','EE','ES','FI','FR','GB','GR','HK','HU','ID','IE','IN','IT','JP','KR','LT','LV','MX','MY','NL','NO','NZ','PE','PH','PL','PT','RO','RU','SE','SG','TH','TR','TW','UA','US','VE','ZA',
];

const names = new Intl.DisplayNames(['en'], { type: 'region' });
export const countryName = (code: string) => names.of(code) ?? code;
