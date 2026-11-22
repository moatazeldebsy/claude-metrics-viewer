/** /api/meta, fetched once and shared by every component (same key). */
export function useMeta() {
  return useFetch("/api/meta", { key: "meta" });
}

/** What the current data source can show; everything is available until /api/meta answers. */
export function useCapabilities() {
  const { data } = useMeta();
  return computed(() => data.value?.capabilities ?? { billedCost: true, seats: true, rawUpstream: true, remoteSplit: true, includesToday: false });
}
