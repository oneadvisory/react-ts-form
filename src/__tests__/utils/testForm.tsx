import React from "react";
import { Control, useController } from "react-hook-form";
import { z } from "zod";
import { createUniqueFieldSchema } from "../../zod/createFieldSchema";
import { createTsForm } from "../../createSchemaForm";
import { useDescription } from "../../FieldContext";

export const textFieldTestId = "text-field";

export function TextField(props: {
  control: Control<any>;
  name: string;
  testId?: string;
}) {
  const {
    field: { onChange, value },
  } = useController({ control: props.control, name: props.name });
  const { label, placeholder } = useDescription();

  return (
    <div data-testid={textFieldTestId}>
      {label && <label>{label}</label>}
      <input
        data-testid={props.testId}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        value={value ? value : ""}
        placeholder={placeholder}
      />
    </div>
  );
}

function BooleanField(props: {
  control: Control<any>;
  name: string;
  testId: string;
}) {
  return <input data-testid={props.testId} />;
}

function NumberField(props: {
  control: Control<any>;
  name: string;
  testId: string;
}) {
  return <input data-testid={props.testId} />;
}

export const customFieldTestId = "custom";

function CustomTextField(props: {
  control: Control<any>;
  name: string;
  aCustomField: string;
  testId: string;
}) {
  return (
    <div data-testid={customFieldTestId}>
      <input data-testid={props.testId} />
    </div>
  );
}
export const enumFieldValues = ["a", "b", "c"] as const;

function EnumField({ enumValues = [] }: { enumValues?: string[] }) {
  const { label, placeholder } = useDescription();

  return (
    <div>
      <span>{label}</span>
      <span>{placeholder}</span>
      {enumValues.map((e, i) => (
        <p key={i + ""}>{e}</p>
      ))}
    </div>
  );
}

export const TestCustomFieldSchema = createUniqueFieldSchema(z.string(), "id");

const mapping = [
  [z.string(), TextField] as const,
  [z.boolean(), BooleanField] as const,
  [z.number(), NumberField] as const,
  [TestCustomFieldSchema, CustomTextField] as const,
  [z.enum(enumFieldValues), EnumField] as const,
] as const;

export const TestForm = createTsForm(mapping, {});

const FormWithSubmit = ({
  children,
  ...props
}: {
  children: JSX.Element[];
  onSubmit: () => void;
}) => (
  <form {...props}>
    {children} <button type="submit">submit</button>
  </form>
);
export const TestFormWithSubmit = createTsForm(mapping, {
  FormComponent: FormWithSubmit,
});
