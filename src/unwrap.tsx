import {
  z,
  ZodArray,
  ZodEffects,
  ZodEnum,
  ZodFirstPartyTypeKind,
  ZodNativeEnum,
  ZodNullable,
  ZodOptional,
} from "zod";
import {
  HIDDEN_ID_PROPERTY,
  isSchemaWithHiddenProperties,
} from "./createFieldSchema";
import { RTFSupportedZodTypes } from "./supportedZodTypes";
import { Decrement } from "./typeUtilities";
import { parseDescription } from "./getMetaInformationForZodType";

const unwrappable = new Set<z.ZodFirstPartyTypeKind>([
  z.ZodFirstPartyTypeKind.ZodOptional,
  z.ZodFirstPartyTypeKind.ZodNullable,
  z.ZodFirstPartyTypeKind.ZodBranded,
  z.ZodFirstPartyTypeKind.ZodEffects,
  z.ZodFirstPartyTypeKind.ZodDefault,
]);

export type UnwrappedRTFSupportedZodTypes = {
  type: RTFSupportedZodTypes;
  [HIDDEN_ID_PROPERTY]: string | null;
  description: ReturnType<typeof parseDescription>;
};

export function unwrap(
  type: RTFSupportedZodTypes
): UnwrappedRTFSupportedZodTypes {
  // Realized zod has a built in "unwrap()" function after writing this.
  // Not sure if it's super necessary.
  let r = type;
  let unwrappedHiddenId: null | string = null;
  let description: UnwrappedRTFSupportedZodTypes["description"] = undefined;

  if (r._def.description) {
    description = parseDescription(r._def.description);
  }

  while (unwrappable.has(r._def.typeName)) {
    if (isSchemaWithHiddenProperties(r)) {
      unwrappedHiddenId = r._def[HIDDEN_ID_PROPERTY];
    }

    switch (r._def.typeName) {
      case z.ZodFirstPartyTypeKind.ZodOptional:
        r = r._def.innerType;
        break;
      case z.ZodFirstPartyTypeKind.ZodBranded:
        r = r._def.type;
        break;
      case z.ZodFirstPartyTypeKind.ZodNullable:
        r = r._def.innerType;
        break;
      case z.ZodFirstPartyTypeKind.ZodEffects:
        r = r._def.schema;
        break;
      // @ts-ignore
      case z.ZodFirstPartyTypeKind.ZodDefault:
        // @ts-ignore
        r = r._def.innerType;
        break;
    }

    if (r._def.description && !description) {
      description = parseDescription(r._def.description);
    }
  }

  let innerHiddenId: null | string = null;

  if (isSchemaWithHiddenProperties(r)) {
    innerHiddenId = r._def[HIDDEN_ID_PROPERTY];
  }

  return {
    type: r,
    [HIDDEN_ID_PROPERTY]: innerHiddenId || unwrappedHiddenId,
    description,
  };
}

export function unwrapEffects(effects: RTFSupportedZodTypes) {
  if (effects._def.typeName === ZodFirstPartyTypeKind.ZodEffects) {
    return effects._def.schema;
  }
  return effects;
}

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

/**
 * @internal
 */
export type UnwrapEffects<
  T extends RTFSupportedZodTypes | ZodEffects<any, any>
> = T extends ZodEffects<infer EffectsSchema, any>
  ? UnwrapEffects<EffectsSchema>
  : T;

export type EnumAsAnyEnum<T extends RTFSupportedZodTypes> =
  T extends ZodEnum<any>
    ? ZodEnum<any>
    : T extends ZodNativeEnum<any>
    ? ZodNativeEnum<any>
    : T;
