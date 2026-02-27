"use client";

import Image from "next/image";

type CalibratingBadgeProps = {
  className?: string;
};

export default function CalibratingBadge({ className }: CalibratingBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-2 text-[var(--muted)] ${className ?? ""}`.trim()}>
      <span className="flex h-4 w-4 items-center justify-center rounded-full">
        <Image
          src="/aop.png"
          alt=""
          width={12}
          height={12}
          className="h-3 w-3 object-contain"
          unoptimized
        />
      </span>
      <span>Calibrating domain</span>
    </span>
  );
}
