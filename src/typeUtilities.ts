import { z } from "zod";
import { RTFBaseZodType, UnwrapEffects } from "./zod";
import { FormComponentMapping } from "./apiTypes";
import { SetRequired } from "type-fest";

/**
 * @internal
 */
export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

/**
 * @internal
 */
export type OptionalKeys<T> = {
  [K in keyof NonNullable<T>]-?: {} extends Pick<NonNullable<T>, K> ? K : never;
}[keyof NonNullable<T>];

// NonNullable to support optional types
/**
 * @internal
 */
export type RequiredKeys<T> = {
  [K in keyof NonNullable<T>]-?: {} extends Pick<NonNullable<T>, K> ? never : K;
}[keyof NonNullable<T>];
type IsEmpty<T> = T[keyof T] extends never ? true : false;
type HasRequiredKey<T> = IsEmpty<RequiredKeys<T>> extends false ? true : false;
type KeysWithRequiredKeyList<T> = {
  [key in keyof T]-?: HasRequiredKey<T[key]> extends true ? key : never;
}[keyof T];

/**
 * @internal
 */
export type Decrement<T extends number> = T extends T
  ? 0 extends T
    ? 0
    : T extends 1
    ? 0
    : T extends 2
    ? 1
    : T extends 3
    ? 2
    : T extends 4
    ? 3
    : T extends 5
    ? 4
    : T extends 6
    ? 5
    : T extends 7
    ? 6
    : T extends 8
    ? 7
    : T extends 9
    ? 8
    : 9
  : never;

/**
 * @internal
 */
export type RequireKeysWithRequiredChildren<T extends Record<string, any>> = T &
  SetRequired<T, KeysWithRequiredKeyList<T>>;

export type FlatType<T> = T extends object ? { [K in keyof T]: T[K] } : T;

/**
 * @internal
 */
export type SafeOmit<T, Key extends keyof T> = IsEmpty<
  Omit<T, Key>
> extends true
  ? never
  : Omit<T, Key>;

/**
 * @internal
 */
export type DistributiveOmit<T, K extends keyof T> = T extends any
  ? SafeOmit<T, K>
  : never;

/**
 * @internal
 */
export type Indexes<V extends readonly any[]> = {
  [K in Exclude<keyof V, keyof Array<any>>]: K;
};

/**
 * @internal
 */
export type UnwrapZodBrand<T extends RTFBaseZodType> =
  UnwrapEffects<T> extends z.ZodBranded<z.ZodTypeAny, infer ID> ? ID : T;

/**
 * @internal
 */
export type UnwrapMapping<T extends FormComponentMapping> = {
  [Index in keyof T]: T[Index] extends readonly [any, any]
    ? readonly [UnwrapZodBrand<UnwrapEffects<T[Index][0]>>, any]
    : never;
};

/**
 * @internal
 */
export type IndexOf<V extends readonly any[], T> = {
  [I in keyof Indexes<V>]: V[I] extends T
    ? T extends V[I]
      ? I
      : never
    : never;
}[keyof Indexes<V>];

/**
 * @internal
 */
export type ExpandRecursively<T> = T extends object
  ? T extends infer O
    ? { [K in keyof O]: ExpandRecursively<O[K]> }
    : never
  : T;

/**
 * @internal
 */
export type NullToUndefined<T> = T extends null ? undefined : T;

/**
 * @internal
 */
export type RemoveNull<T> = ExpandRecursively<{
  [K in keyof T]: NullToUndefined<T[K]>;
}>;
