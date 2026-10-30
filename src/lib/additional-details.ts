import { z } from "zod";

export const additionalDetailsSchema = z
  .array(
    z.object({
      label: z
        .string()
        .trim()
        .min(1, "Give each additional field a name")
        .max(100),
      value: z.string().max(5000),
    }),
  )
  .max(50, "Use at most 50 additional fields")
  .superRefine((fields, context) => {
    const labels = new Set<string>();
    fields.forEach((field, index) => {
      const key = field.label.normalize("NFKC").toLowerCase();
      if (labels.has(key))
        context.addIssue({
          code: "custom",
          path: [index, "label"],
          message: "Additional field names must be unique",
        });
      labels.add(key);
    });
  });
export type AdditionalDetail = z.infer<typeof additionalDetailsSchema>[number];
