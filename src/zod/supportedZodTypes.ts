import {
  ZodArray,
  ZodBoolean,
  ZodBranded,
  ZodDate,
  ZodDiscriminatedUnion,
  ZodEnum,
  ZodMap,
  ZodNullable,
  ZodNumber,
  ZodObject,
  ZodOptional,
  ZodRecord,
  ZodSet,
  ZodString,
  ZodTuple,
  ZodEffects,
  ZodNativeEnum,
  ZodFirstPartySchemaTypes,
  ZodFirstPartyTypeKind,
  ZodDefault,
} from "zod";

/**
 * Reducing this helps with TS performance
 */
export type RTFBaseZodType =
  | ZodString
  | ZodNumber
  | ZodBoolean
  | ZodDate
  | ZodArray<any, any>
  | ZodObject<any, any, any, any, any>
  | ZodDiscriminatedUnion<any, any>
  | ZodTuple<any, any>
  | ZodRecord<any, any>
  | ZodMap<any>
  | ZodSet<any>
  | ZodEnum<any>
  | ZodNativeEnum<any>
  | ZodDefault<any>
  | ZodBranded<any, any>
  | ZodEffects<any, any>;

export type RTFSupportedZodTypes =
  | RTFBaseZodType
  | ZodOptional<any>
  | ZodNullable<any>;

export function isRTFSupportedZodType(
  type: ZodFirstPartySchemaTypes
): type is RTFSupportedZodTypes {
  const typeName = type._def.typeName;
  switch (typeName) {
    case ZodFirstPartyTypeKind.ZodNaN:
    case ZodFirstPartyTypeKind.ZodBigInt:
    case ZodFirstPartyTypeKind.ZodUndefined:
    case ZodFirstPartyTypeKind.ZodNull:
    case ZodFirstPartyTypeKind.ZodAny:
    case ZodFirstPartyTypeKind.ZodUnknown:
    case ZodFirstPartyTypeKind.ZodNever:
    case ZodFirstPartyTypeKind.ZodVoid:
    case ZodFirstPartyTypeKind.ZodUnion:
    case ZodFirstPartyTypeKind.ZodIntersection:
    case ZodFirstPartyTypeKind.ZodFunction:
    case ZodFirstPartyTypeKind.ZodLazy:
    case ZodFirstPartyTypeKind.ZodLiteral:
    case ZodFirstPartyTypeKind.ZodCatch:
    case ZodFirstPartyTypeKind.ZodPromise:
    case ZodFirstPartyTypeKind.ZodPipeline:
      // Intentional fallthrough
      return false;
  }

  // Typescript assertion that we have covered all cases
  const typeAssert: RTFSupportedZodTypes["_def"]["typeName"] = typeName;
  typeAssert;

  return true;
}
