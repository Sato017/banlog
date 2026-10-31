"use client";

import { useEffect, useState } from "react";

export function CoverImage({
  src,
  title,
  className,
  eager = false,
}: {
  src: string | null;
  title: string;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const normalizedSrc = src?.trim()
    ? src.trim().replace(/^\/\//, "https://")
    : null;
  const monogram = Array.from(title.trim())[0] ?? "B";

  return (
    <div
      className={`relative overflow-hidden bg-neutral-100 ${
        className ?? "h-full w-full"
      }`}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center text-3xl font-medium text-neutral-300"
      >
        {monogram}
      </div>

      {normalizedSrc && !failed ? (
        <img
          src={normalizedSrc}
          alt={`${title} 的封面`}
          width={460}
          height={650}
          className="absolute inset-0 h-full w-full object-cover"
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "auto"}
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : null}
    </div>
  );
}
