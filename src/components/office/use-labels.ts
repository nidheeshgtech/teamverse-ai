"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import type { BadgeTone } from "@/ui/badge";

const knownDepartments = ["development", "design", "marketing", "project-management", "meeting-room"] as const;
type KnownDepartment = (typeof knownDepartments)[number];

const isKnown = (slug: string): slug is KnownDepartment => (knownDepartments as readonly string[]).includes(slug);

/** Translated department names; unknown slugs (custom departments) fall back to the slug itself. */
export function useDepartmentLabel() {
  const t = useTranslations("departments");
  return useCallback((slug: string | null) => (slug && isKnown(slug) ? t(slug) : (slug ?? "")), [t]);
}

export function departmentTone(slug: string | null): BadgeTone {
  return slug && isKnown(slug) ? (`dept-${slug}` as BadgeTone) : "neutral";
}
