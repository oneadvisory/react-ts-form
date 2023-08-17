import React, { Fragment } from "react";
import { UseFormReturn } from "react-hook-form";
import { AnyZodObject, ZodEffects, z } from "zod";
import { FieldContextProvider } from "./FieldContext";
import {
  FormComponentMapping,
  MaxDefaultRecursionDepth,
  RTFFormSchemaType,
  noMatchingSchemaErrorMessage,
  propsMapToObect,
} from "./createSchemaForm";
import { useSubmitter } from "./submitter";
import {
  Prev,
  RTFSupportedZodTypes,
  UnwrapEffects,
  UnwrapEffectsValue,
  getComponentForZodType,
  getMetaInformationForZodType,
  isZodArray,
  isZodObject,
  unwrapEffects,
} from "./zod";
import { extractFieldData } from "./zod/fieldData";

export type RenderFunctionProps<
  SchemaType extends AnyZodObject | ZodEffects<any, any>
> = {
  elements: {
    [key in keyof z.infer<UnwrapEffects<SchemaType>>]:
      | JSX.Element
      | JSX.Element[];
  };
  fields: RenderedFieldMap<SchemaType>;
};

export type RenderedFieldMap<
  SchemaType extends AnyZodObject | ZodEffects<any, any>,
  Level extends Prev[number] = MaxDefaultRecursionDepth
> = [Level] extends [never]
  ? never
  : {
      [key in keyof z.infer<UnwrapEffects<SchemaType>>]: EvalFieldMapValue<
        // Both shape and value can be wrapped
        UnwrapEffects<UnwrapEffects<SchemaType>["shape"][key]>,
        Level
      >;
    };

type EvalFieldMapValue<T, Level extends Prev[number]> = T extends z.AnyZodObject
  ? ObjectMapElement<T, Level>
  : T extends z.ZodArray<any>
  ? T["element"] extends z.AnyZodObject
    ? ObjectMapElement<T["element"], Level>[]
    : JSX.Element[]
  : JSX.Element;

type ObjectMapElement<
  SchemaType extends AnyZodObject,
  Level extends Prev[number] = MaxDefaultRecursionDepth
> = RenderedFieldMap<SchemaType, Prev[Level]>;

export type RenderedElement =
  | JSX.Element
  | JSX.Element[]
  | RenderedObjectElements
  | RenderedElement[];
export type RenderedObjectElements = { [key: string]: RenderedElement };

interface RenderFieldsProps<SchemaType extends RTFSupportedZodTypes> {
  form: UseFormReturn<z.infer<UnwrapEffectsValue<SchemaType>>>;
  submitter: ReturnType<typeof useSubmitter>;
  combinedMapping: FormComponentMapping;
  schema: SchemaType;
  fieldComponentProps: any;
  propsMap: ReturnType<typeof propsMapToObect>;
}

export function renderFields<SchemaType extends RTFFormSchemaType>(
  props: RenderFieldsProps<SchemaType>
) {
  const { form, schema } = props;
  type SchemaKey = keyof z.infer<UnwrapEffects<SchemaType>>;
  const _schema = extractFieldData(schema).type;
  if (!isZodObject(_schema)) {
    throw new Error(
      `renderFields expects a zod object schema but got ${_schema._def.typeName}`
    );
  }
  const shape: Record<string, RTFSupportedZodTypes> = _schema._def.shape();
  return Object.entries(shape).reduce(
    (accum, [key, type]: [SchemaKey, RTFSupportedZodTypes]) => {
      // we know this is a string but TS thinks it can be number and symbol so just in case stringify
      const stringKey = key.toString();
      accum[stringKey] = renderComponentForSchemaDeep({
        ...props,
        type,
        key: stringKey,
        prefixedKey: stringKey,
        currentValue: form.getValues()[key],
      });
      return accum;
    },
    {} as RenderedObjectElements
  ) as RenderedFieldMap<SchemaType>;
}

interface RenderedFieldMapProps<
  SchemaType extends RTFSupportedZodTypes,
  NestedSchemaType extends RTFSupportedZodTypes,
  K extends keyof z.infer<UnwrapEffects<SchemaType>>
> extends Omit<RenderFieldsProps<NestedSchemaType>, "schema"> {
  type: SchemaType;
  key: K;
  prefixedKey: string;
  currentValue: any;
}

function renderComponentForSchemaDeep<
  SchemaType extends RTFSupportedZodTypes,
  NestedSchemaType extends RTFSupportedZodTypes,
  K extends keyof z.infer<UnwrapEffects<SchemaType>>
>(
  props: RenderedFieldMapProps<SchemaType, NestedSchemaType, K>
): RenderedElement {
  const {
    form,
    submitter,
    combinedMapping,
    type,
    fieldComponentProps,
    key,
    prefixedKey,
    currentValue,
    propsMap,
  } = props;

  const Component = getComponentForZodType(type, combinedMapping);
  if (!Component) {
    const unwrapped = unwrapEffects(type);
    if (isZodObject(unwrapped)) {
      const shape: Record<string, RTFSupportedZodTypes> =
        unwrapped._def.shape();

      const childKeys: Record<string, RenderedElement> = {};
      Object.entries(shape).forEach(([subKey, subType]) => {
        childKeys[subKey] = renderComponentForSchemaDeep({
          ...props,
          type: subType,
          fieldComponentProps: fieldComponentProps?.[key],
          key: subKey,
          prefixedKey: `${prefixedKey}.${subKey}`,
          currentValue: currentValue?.[subKey],
        });
      });
      return childKeys;
    }
    if (isZodArray(unwrapped)) {
      const ret = ((currentValue as Array<any> | undefined | null) ?? []).map(
        (item, index) => {
          return renderComponentForSchemaDeep({
            ...props,
            type: unwrapped.element,
            fieldComponentProps,
            key,
            prefixedKey: `${prefixedKey}[${index}]`,
            currentValue: item,
          });
        }
      );
      return ret;
    }
    throw new Error(
      noMatchingSchemaErrorMessage(key.toString(), unwrapped._def.typeName)
    );
  }
  const meta = getMetaInformationForZodType(type);

  // TODO: we could define a LeafType in the recursive PropType above that only gets applied when we have an actual mapping then we could type guard to it or cast here
  // until then this thinks (correctly) that fieldProps might not have beforeElement, afterElement at this level of the prop tree
  const fieldProps = (fieldComponentProps?.[key] as any) ?? {};

  const { beforeElement, afterElement } = fieldProps;

  const mergedProps = {
    ...(propsMap.name && { [propsMap.name]: prefixedKey }),
    ...(propsMap.control && { [propsMap.control]: form.control }),
    ...(propsMap.enumValues && {
      [propsMap.enumValues]: meta.enumValues,
    }),
    ...(propsMap.descriptionLabel && {
      [propsMap.descriptionLabel]: meta.description?.label,
    }),
    ...(propsMap.descriptionPlaceholder && {
      [propsMap.descriptionPlaceholder]: meta.description?.placeholder,
    }),
    ...meta.metadata,
    ...fieldProps,
  };
  const ctxLabel = meta.description?.label;
  const ctxPlaceholder = meta.description?.placeholder;

  return (
    <Fragment key={prefixedKey}>
      {beforeElement}
      <FieldContextProvider
        control={form.control}
        name={prefixedKey}
        label={ctxLabel}
        zodType={type}
        placeholder={ctxPlaceholder}
        enumValues={meta.enumValues as string[] | undefined}
        addToCoerceUndefined={submitter.addToCoerceUndefined}
        removeFromCoerceUndefined={submitter.removeFromCoerceUndefined}
      >
        <Component key={prefixedKey} {...mergedProps} />
      </FieldContextProvider>
      {afterElement}
    </Fragment>
  );
}

/***
 * Can be useful in CustomChildComponents to flatten the rendered field map at a given level
 */
export function flattenRenderedElements(val: RenderedElement): JSX.Element[] {
  if (Array.isArray(val)) {
    return val.flatMap((obj) => flattenRenderedElements(obj));
  }

  if (React.isValidElement(val)) {
    return [val];
  }

  if (val && typeof val === "object") {
    return Object.values(val).flatMap((obj) => flattenRenderedElements(obj));
  }

  return [val ?? null];
}
