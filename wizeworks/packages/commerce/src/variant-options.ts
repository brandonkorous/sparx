// What actually tells two versions of one garment apart (issue 182).
//
// `ProductVariant.title` is documented as "computed from the options when
// omitted" and is empty on every seeded variant, so anything reading only
// `title` shows ten identical rows for one product's sizes. The option lattice
// point is the real answer and it is one join away.
//
// This lives here, in ONE place, because two screens already learned it
// separately: the variant catalog endpoint got it in issue 182, and the bundle
// component list did not, so a bundle's parts read as raw SKUs
// ("ASH-OVERSHIRT-M-MOSS") while the picker they were chosen from said
// "M · Moss". A rule applied to one of N places is this repository's most
// common defect shape; a shared function is the only version of it that cannot
// drift. [[feedback_a_fix_leaves_its_neighbour_behind]]

/** One axis of a version: "Size" = "L". */
export interface VariantOptionValue {
  name: string;
  value: string;
}

/** The shape a caller must select for `variantOptions` to read. */
export interface OptionAssignmentRow {
  optionValue: {
    value: string;
    position: number;
    option: { name: string; position: number };
  };
}

/** The Prisma `select` that produces `OptionAssignmentRow[]`. Passed rather
 *  than retyped, so a caller cannot ask for three of the four fields the sort
 *  needs and get a stable-but-wrong order. */
export const VARIANT_OPTION_SELECT = {
  select: {
    optionValue: {
      select: {
        value: true,
        position: true,
        option: { select: { name: true, position: true } },
      },
    },
  },
} as const;

/**
 * A variant's option values, ordered the way the shop authored its options, so
 * every version of a product reads its axes in the same order ("L · Oat",
 * never "Oat · L").
 */
export function variantOptions(assignments: readonly OptionAssignmentRow[]): VariantOptionValue[] {
  return assignments
    .map((a) => a.optionValue)
    .slice()
    .sort((a, b) => a.option.position - b.option.position || a.position - b.position)
    .map((v) => ({ name: v.option.name, value: v.value }));
}

/**
 * The version, said the way a person says it: "M · Moss".
 *
 * Empty when the product has no options at all, which is a real answer — a silk
 * scarf that comes one way has no version to name, and printing its SKU there
 * instead tells the reader nothing they wanted.
 */
export function variantVersionLabel(options: readonly VariantOptionValue[]): string {
  return options.map((o) => o.value).join(' · ');
}
