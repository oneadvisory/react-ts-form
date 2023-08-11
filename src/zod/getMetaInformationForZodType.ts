import { ZodFirstPartySchemaTypes, z } from "zod";
import { RTFSupportedZodTypes } from "./supportedZodTypes";
import { extractFieldData } from "./fieldData";

export const SPLIT_DESCRIPTION_SYMBOL = " // ";

export function parseDescription(description?: string) {
  if (!description) return;
  const [label, ...rest] = description
    .split(SPLIT_DESCRIPTION_SYMBOL)
    .map((e) => e.trim());
  const placeholder = rest.join(SPLIT_DESCRIPTION_SYMBOL);
  return {
    label: label!,
    placeholder: placeholder ? placeholder : undefined,
  };
}

export function getEnumValues(type: RTFSupportedZodTypes) {
  if (type._def.typeName === z.ZodFirstPartyTypeKind.ZodEnum) {
    return type._def.values as readonly string[];
  }
  if (type._def.typeName === z.ZodFirstPartyTypeKind.ZodNativeEnum) {
    return Object.values(type._def.values) as readonly (string | number)[];
  }
  return;
}

export function getMetaInformationForZodType<
  M extends Record<string, any> = Record<string, any>
>(type: ZodFirstPartySchemaTypes) {
  const unwrapped = extractFieldData<M>(type);
  return {
    description: unwrapped.description,
    enumValues: getEnumValues(unwrapped.type),
    metadata: unwrapped.metadata,
  };
}
