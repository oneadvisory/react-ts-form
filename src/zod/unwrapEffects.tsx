import {
  ZodBranded,
  ZodEffects,
  ZodFirstPartyTypeKind,
  ZodNullable,
  ZodOptional,
  ZodTypeAny,
} from "zod";
import { RTFSupportedZodTypes } from "./supportedZodTypes";

export type UnwrapEffects<
  T extends RTFSupportedZodTypes | ZodEffects<any, any, any>
> = T extends ZodEffects<infer EffectsSchema, any, any>
  ? UnwrapEffects<EffectsSchema>
  : T extends ZodOptional<infer OptionalSchema>
  ? UnwrapEffects<OptionalSchema>
  : T extends ZodNullable<infer NullableSchema>
  ? UnwrapEffects<NullableSchema>
  : T;

export type UnwrapEffectsValue<
  T extends RTFSupportedZodTypes | ZodEffects<any, any, any>
> = T extends ZodEffects<any, any, infer EffectsOutput>
  ? EffectsOutput
  : T extends ZodBranded<infer BrandedSchema, any>
  ? UnwrapEffectsValue<BrandedSchema>
  : T extends ZodOptional<infer OptionalSchema>
  ? UnwrapEffectsValue<OptionalSchema>
  : T extends ZodNullable<infer NullableSchema>
  ? UnwrapEffectsValue<NullableSchema>
  : T;

export type MultipleEffects<T extends ZodTypeAny> =
  | T
  | ZodEffects<T>
  | ZodEffects<ZodEffects<T>>
  | ZodEffects<ZodEffects<ZodEffects<T>>>
  | ZodEffects<ZodEffects<ZodEffects<ZodEffects<T>>>>;

export function unwrapEffects<T extends ZodTypeAny>(
  effects: MultipleEffects<T>
): UnwrapEffects<T> {
  if (!effects) {
    throw new Error("effects must be a zod object");
  }

  while (effects._def?.typeName === ZodFirstPartyTypeKind.ZodEffects) {
    if (!effects._def.schema) {
      break;
    }

    effects = effects._def.schema;
  }
  // @ts-expect-error ship it
  return effects as unknown as T;
}
