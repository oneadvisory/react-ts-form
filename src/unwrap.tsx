import {
  ZodArray,
  ZodEffects,
  ZodEnum,
  ZodNativeEnum,
  ZodNullable,
  ZodOptional,
  z,
} from "zod";
import { RTFBaseZodType, RTFSupportedZodTypes, UnwrapEffects } from "./zod";
import { Decrement } from "./typeUtilities";

export type IndexOfUnwrapZodType<T extends RTFBaseZodType> =
  UnwrapEffects<T> extends z.ZodBranded<z.ZodTypeAny, infer ID>
    ? ID
    : UnwrapZodType<T>;

/**
 * Recursion with a depth limit to avoid infinite instantiation error.
 */
export type UnwrapZodType<
  T extends RTFSupportedZodTypes,
  D extends number = 10
> = [D] extends [0]
  ? never
  : T extends ZodOptional<any> | ZodNullable<any>
  ? GenericizeLeafTypes<UnwrapZodType<T["_def"]["innerType"], Decrement<D>>>
  : T extends ZodEffects<infer EffectSchema>
  ? GenericizeLeafTypes<UnwrapZodType<EffectSchema, Decrement<D>>>
  : GenericizeLeafTypes<T>;

export type GenericizeLeafTypes<T extends RTFSupportedZodTypes> =
  ArrayAsLengthAgnostic<EnumAsAnyEnum<T>>;

export type ArrayAsLengthAgnostic<T extends RTFSupportedZodTypes> =
  T extends ZodArray<any, any> ? ZodArray<T["element"]> : T;

export type EnumAsAnyEnum<T extends RTFSupportedZodTypes> =
  T extends ZodEnum<any>
    ? ZodEnum<any>
    : T extends ZodNativeEnum<any>
    ? ZodNativeEnum<any>
    : T;
