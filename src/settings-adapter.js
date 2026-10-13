// Stable DSH owns a settings namespace; newer hosts persist volatile Config fields.
export function createSettingsAdapter(ctx, schema, config, namespace) {
  if (typeof ctx.settings.register === 'function') return ctx.settings.register(namespace, schema)
  if (typeof ctx.settings.configure !== 'function' || typeof ctx.settings.update !== 'function') throw new Error('DSH settings API is unavailable')
  ctx.effect(() => ctx.settings.configure({ auto: false }))
  const entry = ctx.fiber.entry
  const id = entry?.options?.id ?? entry?.id
  if (!id) throw new Error('DSH settings entry is unavailable')
  // A volatile write swaps the fiber's config and reloads the plugin; reads from
  // the apply-time `config` snapshot go stale in between. Prefer the fiber's
  // live config when it is readable and shaped like a config object.
  const liveConfig = () => {
    try {
      const current = ctx.fiber?.config ?? ctx.config
      return current !== null && typeof current === 'object' ? current : config
    } catch {
      return config
    }
  }
  const get = () => Object.fromEntries(Object.entries(liveConfig()).map(([key, value]) => [key, typeof value?.get === 'function' ? value.get() : value]))
  return {
    get,
    update: patch => ctx.settings.update(id, patch),
    watch(listener) { return ctx.on('loader/volatile-update', () => listener(get())) },
  }
}
