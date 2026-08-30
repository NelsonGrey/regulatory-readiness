import { loadInstalledPacks, type InstalledPack } from '@rre/control-catalog'

/**
 * Installed control packs, loaded and validated once at startup (ADR 0005).
 * A pack that fails validation stays in the registry as `valid: false` so the
 * `/packs` endpoint can report it; it cannot be used to create entities.
 */
export class PackRegistry {
  private constructor(private readonly entries: Map<string, InstalledPack>) {}

  static async load(packsDir: string): Promise<PackRegistry> {
    const installed = await loadInstalledPacks(packsDir)
    return new PackRegistry(new Map(installed.map((p) => [p.packKey, p])))
  }

  get(packKey: string): InstalledPack | null {
    return this.entries.get(packKey) ?? null
  }

  list(): InstalledPack[] {
    return [...this.entries.values()]
  }
}

const cache = new Map<string, Promise<PackRegistry>>()

/** Load (and memoise per directory) the pack registry. */
export function getPackRegistry(packsDir: string): Promise<PackRegistry> {
  let pending = cache.get(packsDir)
  if (!pending) {
    pending = PackRegistry.load(packsDir)
    cache.set(packsDir, pending)
  }
  return pending
}
