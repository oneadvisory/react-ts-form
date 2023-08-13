import { ZodFirstPartySchemaTypes, z } from "zod";
import { parseDescription } from "./getMetaInformationForZodType";
import {
  RTFSupportedZodTypes,
  isRTFSupportedZodType,
} from "./supportedZodTypes";
import { getSchemaId } from "./createFieldSchema";
import { getSchemaMetadata } from "./schemaMetadata";
import { UnwrapEffectsMetadata } from "./unwrapEffects";

export type UnwrappedRTFSupportedZodTypes<
  M extends Record<string, any> = Record<string, any>
> = {
  type: RTFSupportedZodTypes;
  uniqueSchemaId: string | null;
  description: ReturnType<typeof parseDescription>;
  metadata: M;
};

const unwrappable = new Set<z.ZodFirstPartyTypeKind>([
  z.ZodFirstPartyTypeKind.ZodOptional,
  z.ZodFirstPartyTypeKind.ZodNullable,
  z.ZodFirstPartyTypeKind.ZodBranded,
  z.ZodFirstPartyTypeKind.ZodEffects,
  z.ZodFirstPartyTypeKind.ZodDefault,
]);

export function extractFieldData<T extends ZodFirstPartySchemaTypes>(
  type: T
): UnwrappedRTFSupportedZodTypes<UnwrapEffectsMetadata<T>> {
  if (!isRTFSupportedZodType(type)) {
    throw new Error(
      `Unsupported zod type: ${type._def.typeName}. Please open an issue if you think this should be supported.`
    );
  }

  // Realized zod has a built in "unwrap()" function after writing this.
  // Not sure if it's super necessary.
  let r = type;
  let unwrappedHiddenId: null | string = null;
  let description: UnwrappedRTFSupportedZodTypes["description"] = undefined;
  let metadata = {} as UnwrapEffectsMetadata<T>;

  if (r._def.description) {
    description = parseDescription(r._def.description);
  }

  while (unwrappable.has(r._def.typeName)) {
    unwrappedHiddenId = getSchemaId(r) ?? unwrappedHiddenId;
    metadata = { ...metadata, ...getSchemaMetadata(r) };

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

  let innerHiddenId = getSchemaId(r);

  return {
    type: r,
    uniqueSchemaId: innerHiddenId ?? unwrappedHiddenId,
    description,
    metadata,
  };
}
