"use client";

import { useId } from "react";
import { diverSvg } from "@/lib/art/diver";

/** A character's diver portrait. Decorative by default; pass `label` when it stands alone. */
export function DiverIcon({
  id,
  size = 32,
  dead = false,
  glow = false,
  className = "",
  label,
}: {
  id: string;
  size?: number;
  dead?: boolean;
  glow?: boolean;
  className?: string;
  label?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`inline-block shrink-0 ${dead ? "opacity-50 grayscale" : ""} ${className}`}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: diverSvg(id, { uid: `${id}${uid}`, dead, glow }) }}
    />
  );
}
