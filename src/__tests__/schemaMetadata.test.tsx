import React, { ComponentProps } from "react";
import { z } from "zod";
import { extractFieldData } from "../zod/fieldData";
import { addSchemaMetadata } from "../zod/schemaMetadata";
import { createTsForm } from "../createSchemaForm";

describe("schema metadata", () => {
  it("should work traverse schema for metadata", () => {
    const schemaWithMetadata = addSchemaMetadata(z.string(), {
      foo: "bar",
    } as const);

    const schemaMetadata = extractFieldData(schemaWithMetadata)
      .metadata satisfies {
      foo: "bar";
    };
    expect(schemaMetadata).toEqual({
      foo: "bar",
    });

    const nestedWithMetadata = schemaWithMetadata
      .refine(() => true)
      .default("foo")
      .optional();
    const nestedMetadata = extractFieldData(nestedWithMetadata)
      .metadata satisfies {
      foo: "bar";
    };

    expect(nestedMetadata).toEqual({
      foo: "bar",
    });
  });

  it("should make provided metadata optional", () => {
    const mapping = [
      [z.string(), ({ foo }: { foo: string }) => <div>{foo}</div>] as const,
    ] as const;

    const Form = createTsForm(mapping, {});
    type Props = ComponentProps<typeof Form>["props"];

    // Params are needed with unscoped schema
    const props: Props = {
      prop: { foo: "foo" },
    };
    expect(props).toBeTruthy();

    const component = (
      <Form
        schema={z.object({ prop: z.string() })}
        props={{
          // @ts-expect-error
          prop: {
            // foo: "foo",
          },
        }}
        onSubmit={() => {}}
      />
    );
    expect(component).toBeTruthy();

    const metadataSchema = z.object({
      foo: addSchemaMetadata(z.string(), {
        foo: "bar",
      }),
    });
    const metadataElement = (
      <Form
        schema={metadataSchema}
        props={{
          foo: {},
        }}
        onSubmit={() => {}}
      />
    );
    expect(metadataElement).toBeTruthy();

    const metadataWithProperty = (
      <Form
        schema={metadataSchema}
        props={{
          foo: {
            foo: "foo",
          },
        }}
        onSubmit={() => {}}
      />
    );
    expect(metadataWithProperty).toBeTruthy();
  });
});
