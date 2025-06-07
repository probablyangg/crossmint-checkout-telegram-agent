import React from "react";

interface DetailsProps {
  values: { label: string; value: React.ReactNode }[];
}

export function Details({ values }: DetailsProps) {
  return (
    <div className="mt-2.5 flex w-full flex-col gap-[18px] rounded-2xl bg-slate-50 p-4 text-base font-medium">
      {values.map((value) => (
        <div key={value.label} className="flex justify-between">
          <div className="text-slate-500">{value.label}</div>
          <div className="text-slate-700">{value.value}</div>
        </div>
      ))}
    </div>
  );
}
