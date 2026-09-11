export type FieldSpec = {
  name: string;
  label: string;
  type: "text" | "textarea" | "email" | "number" | "date" | "select" | "checkbox" | "url";
  required?: boolean;
  hint?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** show this field as a column in the list table */
  column?: boolean;
  /** render in the table only — not an input on the form */
  displayOnly?: boolean;
  /** render value in the table (defaults to String(value)) */
  render?: (row: Record<string, unknown>) => React.ReactNode;
};

export type CrudRow = { id: string } & Record<string, unknown>;
