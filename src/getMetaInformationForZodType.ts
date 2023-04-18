import { z } from "zod";
import { RTFSupportedZodTypes } from "./supportedZodTypes";
import { unwrap } from "./unwrap";

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
  if (!(type._def.typeName === z.ZodFirstPartyTypeKind.ZodEnum)) return;
  return type._def.values as readonly string[];
}

export function getMetaInformationForZodType(type: RTFSupportedZodTypes) {
  const unwrapped = unwrap(type);
  return {
    description: unwrapped.description,
    enumValues: getEnumValues(unwrapped.type),
  };
}
