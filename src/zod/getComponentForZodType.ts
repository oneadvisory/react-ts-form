import { RTFBaseZodType, RTFSupportedZodTypes } from "./supportedZodTypes";
import { isZodTypeEqual } from "./isZodTypeEqual";
import { FormComponentMapping } from "../apiTypes";

export function getMapForZodType<T>(
  zodType: RTFSupportedZodTypes,
  mapping: readonly (readonly [RTFBaseZodType, T])[]
) {
  for (const mappingElement of mapping) {
    if (isZodTypeEqual(zodType, mappingElement[0])) return mappingElement[1];
  }
  return;
}

export function getComponentForZodType(
  zodType: RTFSupportedZodTypes,
  mapping: FormComponentMapping
) {
  return getMapForZodType(zodType, mapping);
}
