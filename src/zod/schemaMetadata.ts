import {
  ZodEffects,
  ZodFirstPartyTypeKind,
  ZodTypeAny,
  input,
  output,
  z,
} from "zod";
import { RTFSupportedZodTypes } from ".";

export const METADATA_ID_PROPERTY = "_rtf_metadata";

type MetadataSupportedTypes = RTFSupportedZodTypes | z.ZodEffects<any>;

export class RTFMetaDataEffect<
  T extends ZodTypeAny | RTFMetaDataEffect<any, any>,
  P extends Record<string, any> = Record<string, any>,
  O = output<T>,
  I = input<T>
> extends ZodEffects<T, O, I> {
  _def!: z.ZodEffectsDef<T> & MetadataProperties<P>;
  readonly RTFMetaDataEffect = true;
}

export type MetadataProperties<T extends Record<string, any>> = {
  [METADATA_ID_PROPERTY]: T;
};

export type SchemaWithMetadata<
  T extends MetadataSupportedTypes,
  P extends Record<string, any>
> = T & {
  _def: T["_def"] & MetadataProperties<P>;
};

export function getSchemaMetadata<
  P extends Record<string, any>,
  T extends MetadataSupportedTypes
>(schemaType: T): MetadataProperties<P> | undefined {
  return METADATA_ID_PROPERTY in schemaType._def
    ? (schemaType._def[METADATA_ID_PROPERTY] as MetadataProperties<P>)
    : undefined;
}

export function addSchemaMetadata<
  T extends MetadataSupportedTypes,
  P extends Record<string, any>
>(schema: T, properties: P): RTFMetaDataEffect<T, P> {
  const metadata = {
    ...getSchemaMetadata<P, T>(schema),
    ...properties,
  };

  const withMetadata = new ZodEffects({
    schema: schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect: { type: "refinement", refinement: () => true },
  }) as RTFMetaDataEffect<T, P>;

  withMetadata._def[METADATA_ID_PROPERTY] = metadata;

  return withMetadata;
}
