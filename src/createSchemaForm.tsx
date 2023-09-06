import { zodResolver } from "@hookform/resolvers/zod";
import React, {
  ComponentProps,
  FunctionComponent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  DeepPartial,
  FormProvider,
  Resolver,
  UseFormReturn,
  useForm,
} from "react-hook-form";
import { OmitIndexSignature, Simplify } from "type-fest";
import { ZodEffects, z } from "zod";

import {
  FormComponentMapping,
  RTFFormSchemaType,
  RTFFormSubmitFn,
} from "./apiTypes";
import {
  RTFFieldProps,
  RenderFunctionProps,
  flattenRenderedElements,
  renderFields,
} from "./fields";
import { duplicateTypeError, printWarningsForSchema } from "./logging";
import { useSubmitter } from "./submitter";
import {
  IndexOf,
  OptionalKeys,
  RequireKeysWithRequiredChildren,
  UnwrapMapping,
} from "./typeUtilities";
import { IndexOfUnwrapZodType } from "./unwrap";
import {
  Prev,
  RTFSupportedZodTypes,
  UnwrapEffects,
  UnwrapEffectsMetadata,
  isZodTypeEqual,
} from "./zod";
import { getSchemaId } from "./zod/createFieldSchema";

export function noMatchingSchemaErrorMessage(
  propertyName: string,
  propertyType: string
) {
  return `No matching zod schema for type \`${propertyType}\` found in mapping for property \`${propertyName}\`. Make sure there's a matching zod schema for every property in your schema.`;
}

export function useFormResultValueChangedErrorMessage() {
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

export type MaxDefaultRecursionDepth = 1;

export type PropType<
  Mapping extends FormComponentMapping,
  SchemaType extends RTFSupportedZodTypes,
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
            Level
          >
        : MappedComponentProps<GetTupleFromMapping<Mapping, SchemaType, key>>;
    }>;

type EvalNestedProps<
  T,
  Mapping extends FormComponentMapping,
  Level extends Prev[number]
> = T extends z.AnyZodObject
  ? PropType<Mapping, T, Prev[Level]>
  : T extends z.ZodArray<any>
  ? PropType<Mapping, T["element"], Prev[Level]>
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

type MappedComponentProps<T> = T extends readonly [any, any]
  ? OmitIndexSignature<
      Simplify<
        PrepareProps<
          ComponentProps<T[1]>,
          RTFFieldProps,
          keyof UnwrapEffectsMetadata<T[0]>
        > &
          ExtraProps
      >
    >
  : never;

type CombineMappings<
  Mapping extends FormComponentMapping,
  InstanceMapping extends FormComponentMapping | undefined
> = InstanceMapping extends readonly [any]
  ? readonly [...InstanceMapping, ...Mapping]
  : Mapping;

export type RTFFormBaseProps<
  Mapping extends FormComponentMapping,
  SchemaType extends z.AnyZodObject | ZodEffects<any, any>
> = {
  /**
   * A callback function that will be called with the data once the form has been submitted and validated successfully.
   */
  onSubmit: RTFFormSubmitFn<SchemaType>;
  /**
   * Initializes your form with default values. Is a deep partial, so all properties and nested properties are optional.
   */
  defaultValues?: DeepPartial<z.infer<SchemaType>>;
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
  props?: PropType<Mapping, SchemaType>;
}>;

export type RTFFormHookProps<
  Mapping extends FormComponentMapping,
  SchemaType extends z.AnyZodObject | ZodEffects<any, any>
> = RTFFormBaseProps<Mapping, SchemaType> & {
  /**
   * A Zod Schema - An input field will be rendered for each property in the schema, based on the mapping passed to `createTsForm`
   */
  schema: SchemaType | undefined;
  mapping: Mapping;
};

export type RTFFormProps<
  Mapping extends FormComponentMapping,
  InstanceMapping extends FormComponentMapping,
  SchemaType extends z.AnyZodObject | ZodEffects<any, any>,
  FormType extends FormComponent = "form"
> = RTFFormBaseProps<CombineMappings<Mapping, InstanceMapping>, SchemaType> & {
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

  children?: FunctionComponent<RenderFunctionProps<SchemaType>>;
} & RequireKeysWithRequiredChildren<{
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
  }
): <
  SchemaType extends RTFFormSchemaType,
  InstanceMapping extends FormComponentMapping = []
>(
  props: RTFFormProps<Mapping, InstanceMapping, SchemaType, FormType>
) => React.ReactElement<any, any> {
  const ActualFormComponent = options?.FormComponent
    ? options.FormComponent
    : "form";
  const schemas = componentMap.map((e) => e[0]);
  checkForDuplicateTypes(schemas);
  checkForDuplicateUniqueFields(schemas);

  function Component<
    SchemaType extends RTFFormSchemaType,
    InstanceMapping extends FormComponentMapping
  >({
    schema,
    mapping: instanceMapping,
    onSubmit,
    props: fieldComponentProps,
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
    FormType
  >): JSX.Element {
    const combinedMapping = [
      ...(instanceMapping || []),
      ...componentMap,
    ] as const;

    const {
      form: _form,
      handleSubmit,
      elements,
      fields,
      // @ts-ignore
    } = useTsForm({
      schema,
      mapping: combinedMapping,
      props: fieldComponentProps,
      form,
      defaultValues,
      onSubmit,
    });

    const customChildrenRef = useRef(CustomChildrenComponent);
    customChildrenRef.current = CustomChildrenComponent;

    const StableComponent = useMemo(() => {
      return (props: any) => customChildrenRef.current?.(props) ?? null;
    }, []);

    return (
      <FormProvider {..._form}>
        <ActualFormComponent {...formProps} onSubmit={handleSubmit}>
          {renderBefore && renderBefore({ submit: handleSubmit })}
          {customChildrenRef.current ? (
            <StableComponent elements={elements} fields={fields} />
          ) : (
            elements
          )}
          {renderAfter && renderAfter({ submit: handleSubmit })}
        </ActualFormComponent>
      </FormProvider>
    );
  }

  // Breaking checking here as the return type doesn't matter and this was causing
  // a potential infinite recursion. Ignoring this here for the sake of time. I'm
  // not sure if this is safe or a sign of an underlying user facing issue.
  return Component as any;
}

export function useTsForm<
  SchemaType extends z.AnyZodObject | ZodEffects<any, any>,
  Mapping extends FormComponentMapping
>({
  schema,
  mapping,
  props: fieldComponentProps,
  form,
  defaultValues,
  onSubmit,
}: RTFFormHookProps<Mapping, SchemaType>) {
  const useFormResultInitialValue = useRef(form);
  if (!!useFormResultInitialValue.current !== !!form) {
    throw new Error(useFormResultValueChangedErrorMessage());
  }
  const resolver: Resolver<z.infer<SchemaType>> = schema
    ? zodResolver(schema)
    : async () => ({ values: {}, errors: {} });

  const _form = (() => {
    if (form) return form;
    const uf: UseFormReturn<z.infer<SchemaType>> = useForm({
      resolver,
      defaultValues,
    });
    return uf;
  })();

  useEffect(() => {
    if (form && defaultValues) {
      form.reset(defaultValues);
    }
  }, []);
  const { handleSubmit, setError } = _form;
  const submitter = useSubmitter({
    resolver,
    onSubmit,
    setError,
  });
  const submitFn = handleSubmit(submitter.submit);

  const renderedFields = schema
    ? renderFields({
        form: _form,
        combinedMapping: mapping,
        schema,
        fieldComponentProps,
        submitter,
      })
    : {};
  const renderedFieldNodes = flattenRenderedElements(renderedFields);

  return {
    form: _form,
    handleSubmit: submitFn,

    elements: renderedFieldNodes,
    fields: renderedFields,
  };
}
