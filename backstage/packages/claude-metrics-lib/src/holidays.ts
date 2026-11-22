import Holidays from 'date-holidays';

const cache = new Map<string, Set<string>>();

/**
 * Public and bank holidays for a country (ISO code like "US", "DE", "GB"; optionally "US-CA" for a state)
 * in the given years, as YYYY-MM-DD. Unknown country → no holidays.
 */
export function holidaysFor(country: string, years: number[]): Set<string> {
  const out = new Set<string>();
  for (const year of years) {
    const key = `${country}|${year}`;
    let days = cache.get(key);
    if (!days) {
      const [c, state] = country.split('-');
      const hd = new Holidays();
      const known = c !== undefined && c in hd.getCountries();
      if (known) hd.init(c, state);
      days = new Set(
        known
          ? hd
              .getHolidays(year)
              .filter(h => h.type === 'public' || h.type === 'bank')
              .map(h => h.date.slice(0, 10))
          : [],
      );
      cache.set(key, days);
    }
    for (const d of days) out.add(d);
  }
  return out;
}

export const holidayCountry = () => process.env.HOLIDAY_COUNTRY || 'US';
