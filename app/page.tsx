"use client";
import { CrumbApp } from "@/components/CrumbApp";
import { RemoteStore } from "@/lib/store";

export default function Page() {
  return <CrumbApp store={RemoteStore} />;
}
