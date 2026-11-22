import { addDays, toDay } from "#lib/dates";

const FILTER_KEYS = ["excludeWeekends", "excludeHolidays", "user", "department"] as const;

/** Dashboard filters live in the URL so any view can be shared. */
export function useFilters() {
  const route = useRoute();
  const router = useRouter();
  const caps = useCapabilities();
  const today = toDay(new Date());
  // Live sources (OpenTelemetry) can show today; the Admin API's data for today is incomplete.
  const latest = computed(() => (caps.value.includesToday ? today : addDays(today, -1)));
  const param = (k: string) => (typeof route.query[k] === "string" && route.query[k] !== "" ? (route.query[k] as string) : null);

  const to = computed(() => param("to") ?? latest.value);
  const from = computed(() => param("from") ?? addDays(to.value, -27));
  const tab = computed(() => param("tab") ?? "overview");

  /** Query sent to every /api route. */
  const query = computed(() => {
    const q: Record<string, string> = { from: from.value, to: to.value };
    for (const k of FILTER_KEYS) {
      const v = param(k);
      if (v) q[k] = v;
    }
    return q;
  });

  function set(patch: Record<string, string | null>) {
    const merged: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(route.query)) if (typeof v === "string") merged[k] = v;
    Object.assign(merged, patch);
    const next = Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== null && v !== "")) as Record<string, string>;
    router.replace({ query: next });
  }

  return { latest, from, to, tab, query, param, set };
}
