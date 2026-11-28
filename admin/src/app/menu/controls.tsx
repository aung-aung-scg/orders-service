"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { MenuItem } from "@/lib/menu-api";
import { menuImageMaxBytes, menuImagePath } from "@/lib/menu-image";
import { submitMenuItem, toggleMenuItem, type MenuState } from "./actions";

function ItemFields({ item, close }: { item?: MenuItem; close: () => void }) {
  const t = useTranslations();
  const [name, setName] = useState(item?.name ?? "");
  const digits = item ? String(item.priceMinor).padStart(3, "0") : "";
  const [price, setPrice] = useState(digits ? digits.slice(0, -2) + "." + digits.slice(-2) : "");
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<string>();
  const [removed, setRemoved] = useState(false);
  const [fileError, setFileError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);
  const [state, action, pending] = useActionState(async (previous: MenuState, form: FormData) => {
    if (file) form.set("image", file);
    if (removed) form.set("removeImage", "yes");
    const result = await submitMenuItem(item?.id, previous, form);
    if (result.saved) close();
    return result;
  }, {});
  const image = file ? preview : removed ? undefined : menuImagePath(item?.imageKey);
  return (
    <form action={action} noValidate className="grid gap-4">
      <label className="grid gap-1.5 text-sm font-medium">
        {t("menu.name")}
        <Input name="name" value={name} onChange={event => setName(event.target.value)} maxLength={80} required
          aria-invalid={Boolean(state.name)} aria-describedby={state.name ? "menu-name-error" : undefined} />
        {state.name && <span id="menu-name-error" className="text-destructive" role="alert">{state.name}</span>}
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        {t("menu.priceThb")}
        <Input name="price" inputMode="decimal" value={price} onChange={event => setPrice(event.target.value)}
          placeholder="120.50" required aria-invalid={Boolean(state.price)}
          aria-describedby={state.price ? "menu-price-error" : undefined} />
        {state.price && <span id="menu-price-error" className="text-destructive" role="alert">{state.price}</span>}
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        {t("menu.imageOptionalUpTo2Mb")}
        <Input ref={input} type="file" accept="image/jpeg,image/png,image/webp" disabled={pending}
          aria-describedby={fileError || state.image ? "menu-image-error" : undefined}
          onChange={event => {
            const selected = event.target.files?.[0];
            if (!selected) return;
            setPreview(undefined);
            if (selected.size > menuImageMaxBytes) {
              setFile(undefined);
              setFileError(t("menu.chooseAnImageNoLargerThan2"));
              event.target.value = "";
              return;
            }
            setFile(selected);
            setPreview(URL.createObjectURL(selected));
            setRemoved(false);
            setFileError(undefined);
          }} />
      </label>
      {(fileError || state.image) && <p id="menu-image-error" className="text-sm text-destructive" role="alert">{fileError || state.image}</p>}
      {image && <div className="flex items-center gap-3">
        <Image src={image} alt={t("menu.menuImagePreview")} width={80} height={80} unoptimized className="size-20 rounded-lg object-cover" />
        <Button type="button" variant="outline" disabled={pending} onClick={() => {
          setFile(undefined);
          setPreview(undefined);
          setRemoved(Boolean(item?.imageKey));
          setFileError(undefined);
          if (input.current) input.current.value = "";
        }}>{t("menu.removeImage")}</Button>
      </div>}
      {state.error && <p className="text-sm text-destructive" role="alert">{state.error}</p>}
      <Button type="submit" disabled={pending}>{pending ? t("auth.saving") : item ? t("menu.saveChanges") : t("menu.addItem")}</Button>
    </form>
  );
}

export function MenuEditor({ item }: { item?: MenuItem }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={item ? "outline" : "default"} size={item ? "sm" : "default"} aria-label={item ? t("menu.edit") + item.name : undefined}>
          {item ? <><Pencil />{" "}{t("menu.edit2")}</> : <><Plus />{" "}{t("menu.addItem")}</>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? t("menu.editMenuItem") : t("menu.addMenuItem")}</DialogTitle>
          <DialogDescription>{t("menu.enterANameAndAPriceIn")}</DialogDescription>
        </DialogHeader>
        {open && <ItemFields item={item} close={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

export function AvailabilitySwitch({ item }: { item: MenuItem }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(toggleMenuItem.bind(null, item.id, !item.available), {});
  return (
    <form action={action} className="space-y-1">
      <button type="submit" role="switch" aria-checked={item.available} aria-label={t("menu.availabilityOfP0", { p0: item.name })}
        disabled={pending} className="inline-flex items-center gap-2 rounded-md text-sm font-medium disabled:opacity-60">
        <span aria-hidden="true" className={`inline-flex h-6 w-10 shrink-0 items-center rounded-full border p-0.5 ${item.available ? "bg-primary" : "border-input bg-muted"}`}>
          <span className={`size-4 rounded-full shadow-sm transition-transform motion-reduce:transition-none ${item.available ? "translate-x-4 bg-primary-foreground" : "bg-muted-foreground"}`} />
        </span>
        {item.available ? t("menu.available") : t("menu.hidden")}
      </button>
      {state.error && <p className="text-sm text-destructive" role="alert">{state.error}</p>}
    </form>
  );
}
