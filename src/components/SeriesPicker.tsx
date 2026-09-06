"use client";

import Link from "next/link";
import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";

export type PickerItem = { key: string; label: string; href: string; active: boolean };
/** label: null for an ungrouped set (goalies' flat 6 attributes). */
export type PickerGroup = { label: string | null; items: PickerItem[] };

const EASE = "cubic-bezier(0.25,0.1,0.25,1)"; // smoother, more gradual settle than ease-in-out
const DURATION = "duration-300";

/** Overall + the category triggers: a bordered pill, filled when it's the expanded one. */
function triggerClass(active: boolean) {
  return `inline-flex items-center gap-1.5 whitespace-nowrap rounded-none px-3 py-1.5 font-display text-sm font-semibold uppercase tracking-wide transition-colors ${
    active
      ? "border-2 border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
      : "border-2 border-[var(--color-border-strong)] text-[var(--color-fg-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-fg)]"
  }`;
}

/** A leaf attribute pill, shown inside an already-framed drop-down box. */
function leafClass(active: boolean) {
  return `whitespace-nowrap rounded-none px-3 py-1.5 text-sm font-medium transition-colors ${
    active
      ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
      : "text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
  }`;
}

/** Vertical collapse — children slide straight down out of a zero-height track. */
function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`grid overflow-hidden ${DURATION} ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      style={{ transitionProperty: "grid-template-rows", transitionTimingFunction: EASE }}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

const CaretIcon = ({ open, size = 13 }: { open: boolean; size?: number }) => (
  <CaretDown
    size={size}
    weight="bold"
    className={`shrink-0 transition-transform ${DURATION} ${open ? "rotate-180" : ""}`}
  />
);

function AttributeBox({ items, open, label }: { items: PickerItem[]; open: boolean; label?: string }) {
  return (
    <div
      className="mt-2 flex flex-wrap gap-1 rounded-none border-2 border-[var(--color-border-strong)] p-1"
      role="group"
      aria-label={label}
    >
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          scroll={false}
          tabIndex={open ? 0 : -1}
          aria-hidden={!open}
          className={leafClass(item.active)}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

/**
 * Overall is a link to the Overall series that also toggles the picker.
 * When open, the category triggers (General / Offense / Defense) reveal
 * beside it — wiping right on `sm`+, dropping down on narrow screens — and
 * each in turn drops its own attributes down as a framed row, one at a
 * time. Goalies have no categories; their flat attribute set just drops
 * down. The filled pill marks whatever is expanded (an open category, else
 * Overall). Closing Overall resets the open category; on first load the
 * picker opens with the active series' category pre-expanded.
 */
export function SeriesPicker({ overall, groups }: { overall: PickerItem; groups: PickerGroup[] }) {
  const ungrouped = groups.find((g) => g.label === null);
  const categories = groups.filter(
    (g): g is { label: string; items: PickerItem[] } => g.label !== null,
  );

  const [open, setOpen] = useState(!overall.active);
  const [openCat, setOpenCat] = useState<string | null>(
    categories.find((c) => c.items.some((i) => i.active))?.label ?? null,
  );

  function toggleOpen() {
    setOpen((v) => !v);
    setOpenCat(null); // reset the drawer so a reopen starts fully collapsed
  }

  // Rendered in both the sm+ wipe row and the mobile drop, so it's shared.
  const categoryButtons = () =>
    categories.map((cat) => {
      const catOpen = open && openCat === cat.label;
      return (
        <button
          key={cat.label}
          type="button"
          onClick={() => setOpenCat((c) => (c === cat.label ? null : cat.label))}
          aria-expanded={catOpen}
          tabIndex={open ? 0 : -1}
          className={triggerClass(catOpen)}
        >
          {cat.label}
          <CaretIcon open={catOpen} size={12} />
        </button>
      );
    });

  return (
    <div>
      <div className="flex flex-wrap items-start">
        <Link
          href={overall.href}
          scroll={false}
          onClick={toggleOpen}
          aria-expanded={open}
          className={triggerClass(overall.active && openCat === null)}
        >
          {overall.label}
          <CaretIcon open={open} />
        </Link>

        {categories.length > 0 && (
          // sm+: horizontal wipe. The row sits at its natural width (w-max,
          // nowrap) so pills never reflow; the max-width track widens past it
          // (~280px of pills) to sweep them in, then settles at content width.
          <div
            className={`hidden overflow-hidden sm:block ${DURATION} ${open ? "max-w-[22rem]" : "max-w-0"}`}
            style={{ transitionProperty: "max-width", transitionTimingFunction: EASE }}
          >
            <div
              className={`flex w-max flex-nowrap items-center gap-2 ${DURATION} ${
                open ? "pl-2 opacity-100 delay-100" : "pl-0 opacity-0"
              }`}
              style={{ transitionProperty: "padding, opacity", transitionTimingFunction: EASE }}
            >
              {categoryButtons()}
            </div>
          </div>
        )}
      </div>

      {categories.length > 0 && (
        // Below sm: no room to wipe right, so the same triggers drop down.
        <div className="sm:hidden">
          <Collapse open={open}>
            <div className="mt-2 flex flex-wrap gap-2">{categoryButtons()}</div>
          </Collapse>
        </div>
      )}

      {ungrouped && (
        <Collapse open={open}>
          <AttributeBox items={ungrouped.items} open={open} />
        </Collapse>
      )}

      {categories.map((cat) => {
        const catOpen = open && openCat === cat.label;
        return (
          <Collapse key={cat.label} open={catOpen}>
            <AttributeBox items={cat.items} open={catOpen} label={cat.label} />
          </Collapse>
        );
      })}
    </div>
  );
}
