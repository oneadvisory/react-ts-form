import React, { Fragment, ReactElement } from "react";
import { UseFormReturn, useWatch } from "react-hook-form";
import { AnyZodObject, ZodEffects, z } from "zod";
import { FieldContextProvider, useContextProt } from "./FieldContext";
import { FormComponentMapping, RTFFormSchemaType } from "./apiTypes";
import {
  MaxDefaultRecursionDepth,
  noMatchingSchemaErrorMessage,
} from "./createSchemaForm";
import { useSubmitter } from "./submitter";
import {
  Prev,
  RTFSupportedZodTypes,
  UnwrapEffects,
  getComponentForZodType,
  getMetaInformationForZodType,
  isZodArray,
  isZodObject,
  unwrapEffects,
} from "./zod";
import { extractFieldData } from "./zod/fieldData";

export type RTFFieldProps = "name" | "control" | "enumValues";

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
  | RenderedObjectElements
  | RenderedElement[];
export type RenderedObjectElements = { [key: string]: RenderedElement };

interface RenderFieldsProps<
  Mapping extends FormComponentMapping,
  SchemaType extends RTFSupportedZodTypes
> {
  form: UseFormReturn<z.infer<SchemaType>>;
  submitter: ReturnType<typeof useSubmitter>;
  combinedMapping: Mapping;
  schema: SchemaType;
  fieldComponentProps: any;
}

export function renderFields<
  Mapping extends FormComponentMapping,
  SchemaType extends RTFFormSchemaType
>(props: RenderFieldsProps<Mapping, SchemaType>) {
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
        schema: type,
        fieldComponentProps: props.fieldComponentProps?.[key],
        prefixedKey: stringKey,
        currentValue: form.getValues()[key],
      });
      return accum;
    },
    {} as RenderedObjectElements
  ) as RenderedFieldMap<SchemaType>;
}

interface RenderedFieldMapProps<
  Mapping extends FormComponentMapping,
  SchemaType extends RTFSupportedZodTypes
> extends RenderFieldsProps<Mapping, SchemaType> {
  prefixedKey: string;
  currentValue: any;
}

function renderComponentForSchemaDeep<
  Mapping extends FormComponentMapping,
  SchemaType extends RTFSupportedZodTypes
>(context: RenderedFieldMapProps<Mapping, SchemaType>): RenderedElement {
  const {
    form,
    submitter,
    combinedMapping,
    schema,
    fieldComponentProps,
    prefixedKey,
    currentValue,
  } = context;

  const Component = getComponentForZodType(schema, combinedMapping);
  if (!Component) {
    var { childFields, unwrapped } = renderObjectChildren<Mapping, SchemaType>(
      context
    );

    if (childFields) {
      return childFields;
    }
    if (isZodArray(unwrapped)) {
      const ret = ((currentValue as Array<any> | undefined | null) ?? []).map(
        (item, index) => {
          return renderComponentForSchemaDeep({
            ...context,
            schema: unwrapped.element,
            fieldComponentProps,
            prefixedKey: `${prefixedKey}[${index}]`,
            currentValue: item,
          });
        }
      );
      return ret;
    }
    throw new Error(
      noMatchingSchemaErrorMessage(
        context.prefixedKey.toString(),
        unwrapped._def.typeName
      )
    );
  }
  const meta = getMetaInformationForZodType(schema);

  const { beforeElement, afterElement } = fieldComponentProps ?? {};

  const mergedProps = {
    name: prefixedKey,
    control: form.control,

    enumValues: meta.enumValues,
    ...meta.metadata,
    ...fieldComponentProps,
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
        zodType={schema}
        placeholder={ctxPlaceholder}
        enumValues={meta.enumValues as string[] | undefined}
        fieldComponentProps={fieldComponentProps}
        submitter={submitter}
        mapping={combinedMapping}
      >
        <Component key={prefixedKey} {...mergedProps} />
      </FieldContextProvider>
      {afterElement}
    </Fragment>
  );
}

export function renderObjectChildren<
  Mapping extends FormComponentMapping,
  SchemaType extends RTFSupportedZodTypes
>(context: RenderedFieldMapProps<Mapping, SchemaType>) {
  const { fieldComponentProps, currentValue, prefixedKey } = context;

  const unwrapped = unwrapEffects(context.schema);

  let childFields: Record<string, RenderedElement> | undefined;
  if (isZodObject(unwrapped)) {
    const shape: Record<string, RTFSupportedZodTypes> = unwrapped._def.shape();

    childFields = {};
    Object.entries(shape).forEach(([subKey, subType]) => {
      childFields![subKey] = renderComponentForSchemaDeep({
        ...context,
        schema: subType,
        fieldComponentProps: fieldComponentProps?.[subKey],
        prefixedKey: `${prefixedKey}.${subKey}`,
        currentValue: currentValue?.[subKey],
      });
    });
  }
  return { childFields, unwrapped };
}

// TODO: Can we make props generic? Is that worth it?
export function SchemaField(props: {
  name: string;
  props?: Record<string, any>;
}): ReactElement {
  const parentContext = useContextProt("SchemaField");
  const { control, submitter, mapping } = parentContext;

  const name = props.name;
  const prefixedKey = parentContext.name + "." + name;

  let schema: RTFSupportedZodTypes = parentContext.zodType;
  let parentFieldComponentProps: any = parentContext.fieldComponentProps;

  const nameParts = name.split(".");
  nameParts.forEach((part) => {
    const unwrappedParent = unwrapEffects(schema);
    if (!isZodObject(unwrappedParent)) {
      throw new Error("SchemaField must be used within a ZodObject");
    }

    schema = unwrappedParent._def.shape()[part];
    parentFieldComponentProps = parentFieldComponentProps?.[part];
  });

  const currentValue = useWatch({
    name: prefixedKey,
    control,
  });

  // TODO: Deep?
  const fieldComponentProps = {
    ...parentFieldComponentProps,
    ...props.props,
  };

  const Component = getComponentForZodType(schema, mapping);
  if (!Component) {
    const unwrapped = unwrapEffects(schema);

    if (isZodObject(unwrapped)) {
      return (
        <>
          {Object.keys(unwrapped._def.shape()).map((key) => (
            <SchemaField key={key} name={key} props={props.props?.[key]} />
          ))}
        </>
      );
    }
    if (isZodArray(unwrapped)) {
      const ret = ((currentValue as Array<any> | undefined | null) ?? []).map(
        (_, index) => {
          return (
            <SchemaField
              key={index}
              name={index.toString()}
              props={fieldComponentProps}
            />
          );
        }
      );
      return <>{ret}</>;
    }
    throw new Error(
      noMatchingSchemaErrorMessage(
        prefixedKey.toString(),
        unwrapped._def.typeName
      )
    );
  }
  const meta = getMetaInformationForZodType(schema);

  const { beforeElement, afterElement } = fieldComponentProps ?? {};

  const mergedProps = {
    name: prefixedKey,
    control: control,

    enumValues: meta.enumValues,
    ...meta.metadata,
    ...fieldComponentProps,
  };
  const ctxLabel = meta.description?.label;
  const ctxPlaceholder = meta.description?.placeholder;

  return (
    <Fragment key={prefixedKey}>
      {beforeElement}
      <FieldContextProvider
        control={control}
        name={prefixedKey}
        label={ctxLabel}
        zodType={schema}
        placeholder={ctxPlaceholder}
        enumValues={meta.enumValues as string[] | undefined}
        fieldComponentProps={fieldComponentProps}
        submitter={submitter}
        mapping={mapping}
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
