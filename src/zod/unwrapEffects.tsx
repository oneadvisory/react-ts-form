import {
  ZodBranded,
  ZodDefault,
  ZodEffects,
  ZodFirstPartySchemaTypes,
  ZodNullable,
  ZodOptional,
  ZodTypeAny,
  z,
} from "zod";
import { RTFMetaDataEffect } from "./schemaMetadata";
import { RTFSupportedZodTypes } from "./supportedZodTypes";

export type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
type MaxEffectRecursionDepth = 10;

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

export type UnwrapEffectsMetadata<
  T extends ZodFirstPartySchemaTypes,
  Level extends Prev[number] = MaxEffectRecursionDepth
> = [Level] extends [never]
  ? {}
  : T extends RTFMetaDataEffect<infer EffectsSchema, infer EffectsMetadata>
  ? UnwrapEffectsMetadata<EffectsSchema, Prev[Level]> & EffectsMetadata
  : InnerType<T> extends never
  ? {}
  : UnwrapEffectsMetadata<InnerType<T>, Prev[Level]>;

export type InnerType<T extends ZodTypeAny> = T extends ZodEffects<
  infer EffectsSchema,
  any,
  any
>
  ? EffectsSchema
  : T extends ZodBranded<infer BrandedSchema, any>
  ? BrandedSchema
  : T extends ZodOptional<infer OptionalSchema>
  ? OptionalSchema
  : T extends ZodNullable<infer NullableSchema>
  ? NullableSchema
  : T extends ZodDefault<infer DefaultSchema>
  ? DefaultSchema
  : never;

export type MultipleEffects<T extends ZodTypeAny> =
  | T
  | ZodEffects<T>
  | ZodEffects<ZodEffects<T>>
  | ZodEffects<ZodEffects<ZodEffects<T>>>
  | ZodEffects<ZodEffects<ZodEffects<ZodEffects<T>>>>;

export const unwrappable = new Set<z.ZodFirstPartyTypeKind>([
  z.ZodFirstPartyTypeKind.ZodOptional,
  z.ZodFirstPartyTypeKind.ZodNullable,
  z.ZodFirstPartyTypeKind.ZodBranded,
  z.ZodFirstPartyTypeKind.ZodEffects,
  z.ZodFirstPartyTypeKind.ZodDefault,
]);

export function unwrapEffects<T extends ZodTypeAny>(
  r: MultipleEffects<T>
): UnwrapEffects<T> {
  if (!r) {
    throw new Error("effects must be a zod object");
  }

  while (unwrappable.has(r._def.typeName)) {
    switch (r._def.typeName) {
      case z.ZodFirstPartyTypeKind.ZodOptional:
      case z.ZodFirstPartyTypeKind.ZodNullable:
      case z.ZodFirstPartyTypeKind.ZodDefault:
        r = r._def.innerType;
        break;
      case z.ZodFirstPartyTypeKind.ZodBranded:
        r = r._def.type;
        break;
      case z.ZodFirstPartyTypeKind.ZodEffects:
        if (!r._def.schema) {
          break;
        }
        r = r._def.schema;
        break;
    }
  }

  // @ts-expect-error ship it
  return r as unknown as T;
}
