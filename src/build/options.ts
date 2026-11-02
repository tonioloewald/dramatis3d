// The export options checked where they are read: a mistyped value is an
// error naming the allowed ones, not silently taken as the other value
// (site/docs/export.md, "Options").

import type { NamingProfile, RestPose } from '../contracts/profile'

export const NAMINGS: readonly NamingProfile[] = ['ue', 'mixamo']
export const REST_POSES: readonly RestPose[] = ['t-pose', 'source']

/** `value`, or `fallback` when it is undefined; throws when it is not one of `allowed`. */
export function option<T extends string>(
  where: string,
  name: string,
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  if (value === undefined) return fallback
  if (!(allowed as readonly unknown[]).includes(value))
    throw new Error(
      `${where}: ${name} must be ${allowed
        .map((a) => `'${a}'`)
        .join(' or ')}, not ${JSON.stringify(value)}`
    )
  return value as T
}
