import { zodResolver } from "@hookform/resolvers/zod";
import React, {
  ComponentProps,
  ForwardRefExoticComponent,
  Fragment,
  FunctionComponent,
  ReactNode,
  RefAttributes,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  DeepPartial,
  ErrorOption,
  FormProvider,
  UseFormReturn,
  useForm,
} from "react-hook-form";
import {
  AnyZodObject,
  ZodArray,
  ZodEffects,
  ZodFirstPartyTypeKind,
  z,
} from "zod";
import { OmitIndexSignature, Simplify } from "type-fest";

import { FieldContextProvider } from "./FieldContext";
import { duplicateTypeError, printWarningsForSchema } from "./logging";
import {
  IndexOf,
  OptionalKeys,
  RequireKeysWithRequiredChildren,
  UnwrapMapping,
} from "./typeUtilities";
import { IndexOfUnwrapZodType } from "./unwrap";
import {
  RTFBaseZodType,
  RTFSupportedZodTypes,
  UnwrapEffects,
  UnwrapEffectsMetadata,
  UnwrapEffectsValue,
  getComponentForZodType,
  getMetaInformationForZodType,
  isZodTypeEqual,
  unwrapEffects,
} from "./zod";
import { getSchemaId } from "./zod/createFieldSchema";
import { extractFieldData } from "./zod/fieldData";

/**
 * @internal
 */
export type ReactProps = Record<string, any>;

/**
 * @internal
 */
export type ReactComponentWithRequiredProps<
  Props extends ReactProps
  // ExtraProps extends Record<string, any> = {}
> =
  | ((props: Props) => JSX.Element)
  | (ForwardRefExoticComponent<Props> & RefAttributes<unknown>);

export type MappingItem<PropType extends ReactProps> = readonly [
  RTFBaseZodType,
  ReactComponentWithRequiredProps<PropType>
];

export type FormComponentMapping = readonly MappingItem<any>[];
export type MappableProp =
  | "control"
  | "name"
  | "enumValues"
  | "descriptionLabel"
  | "descriptionPlaceholder";
export type PropsMapping = readonly (readonly [MappableProp, string])[];

export function noMatchingSchemaErrorMessage(
  propertyName: string,
  propertyType: string
) {
  return `No matching zod schema for type \`${propertyType}\` found in mapping for property \`${propertyName}\`. Make sure there's a matching zod schema for every property in your schema.`;
}

export function useFormResultValueChangedErrorMesssage() {
  return `useFormResult prop changed - its value shouldn't changed during the lifetime of the component.`;
}

/**
 * @internal
 */
export type FormComponent = "form" | ((props: any) => JSX.Element);

export interface ExtraProps {
  /**
   * An element to render before the field.
   */
  beforeElement?: ReactNode;
  /**
   * An element to render after the field.
   */
  afterElement?: ReactNode;
}

function checkForDuplicateTypes(array: RTFSupportedZodTypes[]) {
  var combinations = array.flatMap((v, i) =>
    array.slice(i + 1).map((w) => [v, w] as const)
  );
  for (const [a, b] of combinations) {
    printWarningsForSchema(a);
    printWarningsForSchema(b);
    if (isZodTypeEqual(a!, b)) {
      duplicateTypeError();
    }
  }
}

function checkForDuplicateUniqueFields(array: RTFSupportedZodTypes[]) {
  let usedIdsSet = new Set<string>();
  for (const type of array) {
    const schemaId = getSchemaId(type);
    if (schemaId) {
      if (usedIdsSet.has(schemaId))
        throw new Error(duplicateIdErrorMessage(schemaId));
      usedIdsSet.add(schemaId);
    }
  }
}

export function duplicateIdErrorMessage(id: string) {
  return `Duplicate id passed to createFieldSchema: ${id}. Ensure that each id is only being used once and that createFieldSchema is only called at the top level.`;
}

const defaultPropsMap = [
  ["name", "name"] as const,
  ["control", "control"] as const,
  ["enumValues", "enumValues"] as const,
] as const;

function propsMapToObect(propsMap: PropsMapping) {
  const r: { [key in MappableProp]+?: string } = {};
  for (const [mappable, toProp] of propsMap) {
    r[mappable] = toProp;
  }
  return r;
}

export type RTFFormSchemaType = z.AnyZodObject | ZodEffects<any, any>;
export type RTFFormSubmitFn<SchemaType extends RTFFormSchemaType> = (
  values: z.infer<SchemaType>
) => void | Promise<void>;
export type SchemaShape<SchemaType extends RTFSupportedZodTypes> = ReturnType<
  UnwrapEffects<SchemaType>["_def"]["shape"]
>;

export type IndexOfSchemaInMapping<
  Mapping extends FormComponentMapping,
  SchemaType extends RTFSupportedZodTypes,
  key extends keyof z.infer<UnwrapEffects<SchemaType>>
> = IndexOf<
  UnwrapMapping<Mapping>,
  readonly [IndexOfUnwrapZodType<SchemaShape<SchemaType>[key]>, any]
>;

export type GetTupleFromMapping<
  Mapping extends FormComponentMapping,
  SchemaType extends RTFSupportedZodTypes,
  key extends keyof z.infer<UnwrapEffects<SchemaType>>
> = IndexOfSchemaInMapping<Mapping, SchemaType, key> extends never
  ? never
  : Mapping[IndexOfSchemaInMapping<Mapping, SchemaType, key>] extends readonly [
      any,
      any
    ]
  ? readonly [
      SchemaShape<SchemaType>[key],
      Mapping[IndexOfSchemaInMapping<Mapping, SchemaType, key>][1]
    ]
  : never;

export type Prev = [never, 0, 1, 2, 3];
export type MaxDefaultRecursionDepth = 1;

export type PropType<
  Mapping extends FormComponentMapping,
  SchemaType extends RTFSupportedZodTypes,
  PropsMapType extends PropsMapping = typeof defaultPropsMap,
  // this controls the depth we allow TS to go into the schema. 2 is enough for most cases, but we could consider exposing this as a generic to allow users to control the depth
  Level extends Prev[number] = MaxDefaultRecursionDepth
> = [Level] extends [never]
  ? never
  : RequireKeysWithRequiredChildren<{
      [key in keyof z.infer<UnwrapEffects<SchemaType>>]?: GetTupleFromMapping<
        Mapping,
        SchemaType,
        key
      > extends never
        ? EvalNestedProps<
            // Both shape and value can be wrapped
            UnwrapEffects<UnwrapEffects<SchemaType>["shape"][key]>,
            Mapping,
            PropsMapType,
            Level
          >
        : MappedComponentProps<
            GetTupleFromMapping<Mapping, SchemaType, key>,
            PropsMapType
          >;
    }>;

type EvalNestedProps<
  T,
  Mapping extends FormComponentMapping,
  PropsMapType extends PropsMapping,
  Level extends Prev[number]
> = T extends z.AnyZodObject
  ? PropType<Mapping, T, PropsMapType, Prev[Level]>
  : T extends z.ZodArray<any>
  ? PropType<Mapping, T["element"], PropsMapType, Prev[Level]>
  : never;

type PrepareProps<
  T extends Record<string, any>,
  omit extends string | number | symbol,
  optional extends string | number | symbol
> =
  // This ensures that any object unions from instance mappings are treated as distinct objects
  // vs. being reduced to objects with only the intersection of properties.
  //
  // Via: https://github.com/sindresorhus/type-fest/blob/main/source/union-to-intersection.d.ts
  // `extends unknown` is always going to be the case and is used to convert the
  // `Union` into a [distributive conditional
  // type](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-8.html#distributive-conditional-types).
  T extends unknown
    ? {
        [P in Exclude<keyof T, omit | optional | OptionalKeys<T>>]: T[P];
      } & {
        [P in (optional | OptionalKeys<T>) & keyof T]?: T[P];
      }
    : never;

type MappedComponentProps<
  T,
  PropsMapType extends PropsMapping
> = T extends readonly [any, any]
  ? OmitIndexSignature<
      Simplify<
        PrepareProps<
          ComponentProps<T[1]>,
          PropsMapType[number][1],
          keyof UnwrapEffectsMetadata<T[0]>
        > &
          ExtraProps
      >
    >
  : never;

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
> = JSX.Element & {
  fields: RenderedFieldMap<SchemaType, Prev[Level]>;
};

type CombineMappings<
  Mapping extends FormComponentMapping,
  InstanceMapping extends FormComponentMapping | undefined
> = InstanceMapping extends readonly [any]
  ? readonly [...InstanceMapping, ...Mapping]
  : Mapping;

export type RTFFormProps<
  Mapping extends FormComponentMapping,
  InstanceMapping extends FormComponentMapping,
  SchemaType extends z.AnyZodObject | ZodEffects<any, any>,
  PropsMapType extends PropsMapping = typeof defaultPropsMap,
  FormType extends FormComponent = "form"
> = {
  /**
   * A Zod Schema - An input field will be rendered for each property in the schema, based on the mapping passed to `createTsForm`
   */
  schema: SchemaType;

  /**
   * An array mapping zod schemas to components. This will be merged with the mapping passed to `createTsForm`.
   * All maps in this list will have priority over those in the second list.
   */
  mapping?: InstanceMapping;

  /**
   * A callback function that will be called with the data once the form has been submitted and validated successfully.
   */
  onSubmit: RTFFormSubmitFn<SchemaType>;
  /**
   * Initializes your form with default values. Is a deep partial, so all properties and nested properties are optional.
   */
  defaultValues?: DeepPartial<z.infer<UnwrapEffectsValue<SchemaType>>>;
  /**
   * A function that renders components after the form, the function is passed a `submit` function that can be used to trigger
   * form submission.
   * @example
   * ```tsx
   * <Form
   *   // ...
   *   renderAfter={({submit})=><button onClick={submit}>Submit</button>}
   * />
   * ```
   */
  renderAfter?: (vars: { submit: () => void }) => ReactNode;
  /**
   * A function that renders components before the form, the function is passed a `submit` function that can be used to trigger
   * form submission.
   * @example
   * ```tsx
   * <Form
   *   // ...
   *   renderBefore={({submit})=><button onClick={submit}>Submit</button>}
   * />
   * ```
   */
  renderBefore?: (vars: { submit: () => void }) => ReactNode;
  /**
   * Use this if you need access to the `react-hook-form` useForm() in the component containing the form component (if you need access to any of its other properties.)
   * This will give you full control over you form state (in case you need check if it's dirty or reset it or anything.)
   * @example
   * ```tsx
   * function Component() {
   *   const form = useForm();
   *   return <MyForm useFormResult={form}/>
   * }
   * ```
   */
  form?: UseFormReturn<z.infer<SchemaType>>;
  children?: FunctionComponent<RenderedFieldMap<SchemaType>>;
} & RequireKeysWithRequiredChildren<{
  /**
   * Props to pass to the individual form components. The keys of `props` will be the names of your form properties in the form schema, and they will
   * be typesafe to the form components in the mapping passed to `createTsForm`. If any of the rendered form components have required props, this is required.
   * @example
   * ```tsx
   * <MyForm
   *  schema={z.object({field: z.string()})}
   *  props={{
   *    field: {
   *      // TextField props
   *    }
   *  }}
   * />
   * ```
   */
  props?: PropType<
    CombineMappings<Mapping, InstanceMapping>,
    SchemaType,
    PropsMapType
  >;
  /**
   * Props to pass to the form container component (by default the props that "form" tags accept)
   */
  formProps?: Omit<ComponentProps<FormType>, "children" | "onSubmit">;
}>;

/**
 * Creates a reusable, typesafe form component based on a zod-component mapping.
 * @example
 * ```tsx
 * const mapping = [
 *  [z.string, TextField] as const
 * ] as const
 * const MyForm = createTsForm(mapping)
 * ```
 * @param componentMap A zod-component mapping. An array of 2-tuples where the first element is a zod schema and the second element is a React Functional Component.
 * @param options Optional - A custom form component to use as the container for the input fields.
 */
export function createTsForm<
  Mapping extends FormComponentMapping,
  PropsMapType extends PropsMapping = typeof defaultPropsMap,
  FormType extends FormComponent = "form"
>(
  /**
   * An array mapping zod schemas to components.
   * @example
   * ```tsx
   * const mapping = [
   *  [z.string(), TextField] as const
   *  [z.boolean(), CheckBoxField] as const
   * ] as const
   *
   * const MyForm = createTsForm(mapping);
   * ```
   */
  componentMap: Mapping,
  /**
   * Options to customize your form.
   */
  options?: {
    /**
     * The component to wrap your fields in. By default, it is a `<form/>`.
     * @example
     * ```tsx
     * function MyCustomFormContainer({children, onSubmit}:{children: ReactNode, onSubmit: ()=>void}) {
     *  return (
     *    <form onSubmit={onSubmit}>
     *      {children}
     *      <button>Submit</button>
     *    </form>
     *  )
     * }
     * const MyForm = createTsForm(mapping, {
     *  FormComponent: MyCustomFormContainer
     * })
     * ```
     */
    FormComponent?: FormType;
    /**
     * Modify which props the form control and such get passed to when rendering components. This can make it easier to integrate existing
     * components with `@ts-react/form` or modify its behavior. The values of the object are the names of the props to forward the corresponding
     * data to.
     * @default {
     *  name: "name",
     *  control: "control",
     *  enumValues: "enumValues",
     * }
     * @example
     * ```tsx
     * function MyTextField({someControlProp}:{someControlProp: Control<any>}) {
     *  //...
     * }
     *
     * const createTsForm(mapping, {
     *  propsMap: {
     *    control: "someControlProp"
     *  }
     * })
     * ```
     */
    propsMap?: PropsMapType;
  }
): <
  SchemaType extends RTFFormSchemaType,
  InstanceMapping extends FormComponentMapping = []
>(
  props: RTFFormProps<
    Mapping,
    InstanceMapping,
    SchemaType,
    PropsMapType,
    FormType
  >
) => React.ReactElement<any, any> {
  const ActualFormComponent = options?.FormComponent
    ? options.FormComponent
    : "form";
  const schemas = componentMap.map((e) => e[0]);
  checkForDuplicateTypes(schemas);
  checkForDuplicateUniqueFields(schemas);
  const propsMap = propsMapToObect(
    options?.propsMap ? options.propsMap : defaultPropsMap
  );

  function Component<
    SchemaType extends RTFFormSchemaType,
    InstanceMapping extends FormComponentMapping
  >({
    schema,
    mapping: instanceMapping,
    onSubmit,
    props,
    formProps,
    defaultValues,
    renderAfter,
    renderBefore,
    form,
    children: CustomChildrenComponent,
  }: RTFFormProps<
    Mapping,
    InstanceMapping,
    SchemaType,
    PropsMapType,
    FormType
  >): JSX.Element {
    const combinedMapping = [
      ...(instanceMapping || []),
      ...componentMap,
    ] as const;

    const useFormResultInitialValue = useRef(form);
    if (!!useFormResultInitialValue.current !== !!form) {
      throw new Error(useFormResultValueChangedErrorMesssage());
    }
    const resolver = zodResolver(schema);
    const _form = (() => {
      if (form) return form;
      const uf = useForm({
        resolver,
        defaultValues,
      });
      return uf;
    })();

    const customChildrenRef = useRef(CustomChildrenComponent);
    customChildrenRef.current = CustomChildrenComponent;

    const StableComponent = useMemo(() => {
      return (props: any) => customChildrenRef.current?.(props) ?? null;
    }, []);

    useEffect(() => {
      if (form && defaultValues) {
        form.reset(defaultValues);
      }
    }, []);
    const { control, handleSubmit, setError, getValues } = _form;
    const submitter = useSubmitter({
      resolver,
      onSubmit,
      setError,
    });
    const submitFn = handleSubmit(submitter.submit);

    function renderComponentForSchemaDeep<
      NestedSchemaType extends RTFSupportedZodTypes,
      K extends keyof z.infer<UnwrapEffects<SchemaType>>
    >(
      type: NestedSchemaType,
      props: any,
      key: K,
      prefixedKey: string,
      currentValue: any
    ): RenderedElement {
      const Component = getComponentForZodType(type, combinedMapping);
      if (!Component) {
        const unwrapped = unwrapEffects(type);
        if (isAnyZodObject(unwrapped)) {
          const shape: Record<string, RTFSupportedZodTypes> =
            unwrapped._def.shape();

          const childKeys: Record<string, RenderedElement> = {};
          const childList = Object.entries(shape).map(([subKey, subType]) => {
            childKeys[subKey] = renderComponentForSchemaDeep(
              subType,
              props?.[key],
              subKey,
              `${prefixedKey}.${subKey}`,
              currentValue && currentValue[subKey]
            );
            return childKeys[subKey];
          });

          const ObjectWrapper = (
            <>{childList}</>
          ) as ObjectMapElement<AnyZodObject>;
          Object.assign(ObjectWrapper, childKeys);

          return ObjectWrapper;
        }
        if (isZodArray(unwrapped)) {
          return ((currentValue as Array<any> | undefined | null) ?? []).map(
            (item, index) => {
              return renderComponentForSchemaDeep(
                unwrapped.element,
                props,
                key,
                `${prefixedKey}[${index}]`,
                item
              );
            }
          );
        }
        throw new Error(
          noMatchingSchemaErrorMessage(key.toString(), unwrapped._def.typeName)
        );
      }
      const meta = getMetaInformationForZodType(type);

      // TODO: we could define a LeafType in the recursive PropType above that only gets applied when we have an actual mapping then we could typeguard to it or cast here
      // until then this thinks (correctly) that fieldProps might not have beforeElement, afterElement at this level of the prop tree
      const fieldProps = props && props[key] ? (props[key] as any) : {};

      const { beforeElement, afterElement } = fieldProps;

      const mergedProps = {
        ...(propsMap.name && { [propsMap.name]: prefixedKey }),
        ...(propsMap.control && { [propsMap.control]: control }),
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
            control={control}
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
    function renderFields(schema: SchemaType, props: any | undefined) {
      type SchemaKey = keyof z.infer<UnwrapEffects<SchemaType>>;
      const _schema = extractFieldData(schema).type;
      if (!isAnyZodObject(_schema)) {
        throw new Error(
          `renderFields expects a zod object schema but got ${_schema._def.typeName}`
        );
      }
      const shape: Record<string, RTFSupportedZodTypes> = _schema._def.shape();
      return Object.entries(shape).reduce(
        (accum, [key, type]: [SchemaKey, RTFSupportedZodTypes]) => {
          // we know this is a string but TS thinks it can be number and symbol so just in case stringify
          const stringKey = key.toString();
          accum[stringKey] = renderComponentForSchemaDeep(
            type,
            props as any,
            stringKey,
            stringKey,
            getValues()[key]
          );
          return accum;
        },
        {} as RenderedObjectElements
      ) as RenderedFieldMap<SchemaType>;
    }

    const renderedFields = renderFields(schema, props);
    const renderedFieldNodes = flattenRenderedElements(renderedFields);
    return (
      <FormProvider {..._form}>
        <ActualFormComponent {...formProps} onSubmit={submitFn}>
          {renderBefore && renderBefore({ submit: submitFn })}
          {customChildrenRef.current ? (
            <StableComponent {...renderedFields} />
          ) : (
            renderedFieldNodes
          )}
          {renderAfter && renderAfter({ submit: submitFn })}
        </ActualFormComponent>
      </FormProvider>
    );
  }

  // Breaking checking here as the return type doesn't matter and this was causing
  // a potential infinite recursion. Ignoring this here for the sake of time. I'm
  // not sure if this is safe or a sign of an underlying user facing issue.
  return Component as any;
}
// handles internal custom submit logic
// Implements a workaround to allow devs to set form values to undefined (as it breaks react hook form)
// For example https://github.com/react-hook-form/react-hook-form/discussions/2797
function useSubmitter<SchemaType extends RTFFormSchemaType>({
  resolver,
  onSubmit,
  setError,
}: {
  resolver: ReturnType<typeof zodResolver>;
  onSubmit: RTFFormSubmitFn<SchemaType>;
  setError: ReturnType<typeof useForm>["setError"];
}) {
  const coerceUndefinedFieldsRef = useRef<Set<string>>(new Set());

  function addToCoerceUndefined(fieldName: string) {
    coerceUndefinedFieldsRef.current.add(fieldName);
  }

  function removeFromCoerceUndefined(fieldName: string) {
    coerceUndefinedFieldsRef.current.delete(fieldName);
  }

  function removeUndefined(data: any) {
    const r = { ...data };
    for (const undefinedField of coerceUndefinedFieldsRef.current) {
      delete r[undefinedField];
    }
    return r;
  }

  function submit(data: z.infer<SchemaType>) {
    return resolver(removeUndefined(data), {} as any, {} as any).then(
      async (e) => {
        const errorKeys = Object.keys(e.errors);
        if (!errorKeys.length) {
          await onSubmit(data);
          return;
        }
        for (const key of errorKeys) {
          setError(
            key as any,
            (e.errors as any)[key] as unknown as ErrorOption
          );
        }
      }
    );
  }

  return {
    submit,
    removeUndefined,
    removeFromCoerceUndefined,
    addToCoerceUndefined,
  };
}

const isAnyZodObject = (schema: RTFSupportedZodTypes): schema is AnyZodObject =>
  schema._def.typeName === ZodFirstPartyTypeKind.ZodObject;
const isZodArray = (schema: RTFSupportedZodTypes): schema is ZodArray<any> =>
  schema._def.typeName === ZodFirstPartyTypeKind.ZodArray;

export type RenderedElement =
  | JSX.Element
  | JSX.Element[]
  | RenderedObjectElements
  | RenderedElement[];
export type RenderedObjectElements = { [key: string]: RenderedElement };

/***
 * Can be useful in CustomChildComponents to flatten the rendered field map at a given level
 */
export function flattenRenderedElements(val: RenderedElement): JSX.Element[] {
  return Array.isArray(val)
    ? val.flatMap((obj) => flattenRenderedElements(obj))
    : typeof val === "object" && val !== null && !React.isValidElement(val)
    ? Object.values(val).reduce((accum: JSX.Element[], val) => {
        return accum.concat(flattenRenderedElements(val as any));
      }, [] as JSX.Element[])
    : [val];
}
