// handles internal custom submit logic
// Implements a workaround to allow devs to set form values to undefined (as it breaks react hook form)

import { useRef } from "react";
import { ErrorOption, Resolver, useForm } from "react-hook-form";
import { z } from "zod";
import { RTFFormSchemaType, RTFFormSubmitFn } from "./apiTypes";

// For example https://github.com/react-hook-form/react-hook-form/discussions/2797
export function useSubmitter<SchemaType extends RTFFormSchemaType>({
  resolver,
  onSubmit,
  setError,
}: {
  resolver: Resolver<z.infer<SchemaType>>;
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

  async function submit(data: z.infer<SchemaType>) {
    const e = await resolver(removeUndefined(data), {} as any, {} as any);
    const errorKeys = Object.keys(e.errors);
    if (!errorKeys.length) {
      await onSubmit(data);
      return;
    }
    for (const key of errorKeys) {
      setError(key as any, (e.errors as any)[key] as unknown as ErrorOption);
    }
  }

  return {
    submit,
    removeUndefined,
    removeFromCoerceUndefined,
    addToCoerceUndefined,
  };
}
