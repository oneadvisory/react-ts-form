import { RTFBaseZodType, RTFSupportedZodTypes } from "./supportedZodTypes";
import { isZodTypeEqual } from "./isZodTypeEqual";

export function getComponentForZodType<T>(
  zodType: RTFSupportedZodTypes,
  mapping: readonly (readonly [RTFBaseZodType, T])[]
) {
  for (const mappingElement of mapping) {
    if (isZodTypeEqual(zodType, mappingElement[0])) return mappingElement[1];
  }
  return;
}
