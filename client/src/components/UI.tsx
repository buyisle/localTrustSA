import { AlertCircle, CheckCircle2, LoaderCircle, LayoutGrid } from "lucide-react";
import { categories } from "../lib/marketplace";
import type { ReactNode } from "react";
export function CategoryIcon({ category, size = 24 }: { category: string; size?: number }) { const Icon = categories.find(item => item.name === category)?.icon || LayoutGrid; return <Icon size={size} aria-hidden="true" />; }
export function Notice({ children, success = false }: { children: ReactNode; success?: boolean }) { return <div className={`notice ${success ? "success" : "error"}`} role={success ? "status" : "alert"}>{success ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}<span>{children}</span></div>; }
export function Loading({ text = "Loading…" }: { text?: string }) { return <div className="loading" role="status"><LoaderCircle className="spin" size={24} />{text}</div>; }
export function EmptyState({ title, children }: { title: string; children: ReactNode }) { return <div className="empty-state"><span className="empty-icon"><LayoutGrid size={28} /></span><h3>{title}</h3><p>{children}</p></div>; }
